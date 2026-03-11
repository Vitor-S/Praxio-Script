// ==UserScript==
// @name         Script SLA
// @namespace
// @version      1.0.4
// @description  Script para manipular a página de ticket do portal
// @author       Vitor
// @match        https://portaldocliente.praxio.com.br/Ticket/TicketPrincipal/*
// @run-at       document-idle
// @grant        GM_addStyle
// @require      https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js
// @require      https://cdn.jsdelivr.net/npm/mammoth/mammoth.browser.min.js
// ==/UserScript==

function formatXML(xml) {

    const PADDING = "  "
    const reg = /(>)(<)(\/*)/g

    xml = xml.replace(reg, "$1\n$2$3")

    let pad = 0

    return xml.split("\n").map(node => {

        let indent = 0

        if (node.match(/.+<\/\w[^>]*>$/)) {
            indent = 0
        } else if (node.match(/^<\/\w/)) {
            if (pad !== 0) pad -= 1
        } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
            indent = 1
        }

        const line = PADDING.repeat(pad) + node

        pad += indent

        return line

    }).join("\n")

}

async function createTabEmpresa() {
    const tabsContainer = document.querySelector("#tabCliente").parentElement
    const tabEmpresa = document.querySelector("#tabCliente").cloneNode(false)
    const nome_empresa = document.querySelector("#sinalizadorCliente").innerText.split("Cliente - ")[1]

    tabEmpresa.id = "tabDadosEmpresa"
    let empresa = []

    try {
        const response = await fetch(
            `https://portal-livid-five.vercel.app/api/getEmpresaByName?nome_empresa=${nome_empresa}`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            }
        )

        if (!response.ok) {
            throw new Error("Erro ao fazer login")
        }

        const data = await response.json()
        empresa = data[0]
    } catch (err) {
        console.error("Erro ao buscar dados da empresa:", err)
        return null
    }

    if (!empresa) {
        tabEmpresa.innerHTML = "<h1>Erro ao buscar dados</h1>"
    } else {
        tabEmpresa.innerHTML = `
<div class="widget-box widget-color-blue" style="margin: 10px;">
  <div class="widget-header">
    <h4 class="widget-title">Dados da Empresa</h4>
  </div>

  <div class="widget-body">
    <div class="widget-main">

      <div style="display: grid; grid-template-columns: 1fr 2fr; row-gap: 8px; column-gap: 16px;">
        <span><strong>Empresa</strong></span>
        <span>${empresa.nome_fantasia}</span>

        <span><strong>Banco</strong></span>
        <span>${empresa.banco}</span>

        <span><strong>IP Banco</strong></span>
        <span>${empresa.ip_banco}</span>

        <span><strong>URL de Serviço</strong></span>
        <span>
          <a href="${empresa.url_servico}" target="_blank">
            ${empresa.url_servico}
          </a>
        </span>

        <span><strong>Nome no Portal</strong></span>
        <span>${empresa.nome_portal}</span>
      </div>

      <hr>

      <h5>Sites</h5>
      ${empresa.url_sites?.length
            ? `
            <ul>
              ${empresa.url_sites
            .map(site => `<li><a href="${site.url_site}" target="_blank">${site.url_site}</a></li>`)
            .join("")}
            </ul>
          `
                : `<span>Nenhum site cadastrado</span>`
            }

      <hr>

      <h5>POS</h5>
      ${empresa.pos_empresas?.length
            ? `
            <ul>
              ${empresa.pos_empresas
            .map(p =>
                 p.pos
                 ? `<li>${p.pos.marca} - ${p.pos.modelo}</li>`
                            : `<li>POS não vinculada</li>`
                    )
            .join("")}
            </ul>
          `
                : `<span>Nenhuma POS cadastrada</span>`
            }

    </div>
  </div>
</div>

        `
    }

    tabsContainer.appendChild(tabEmpresa)
}

function createTabButton() {
    const originalTabButton = document.querySelector("#abaIndicadores").parentElement;
    const empresaTabButton = originalTabButton.cloneNode(true);

    empresaTabButton.querySelector("a").href = ""
    empresaTabButton.querySelector("a").innerText = "Dados da Empresa"
    originalTabButton.insertAdjacentElement("afterend", empresaTabButton);

    empresaTabButton.addEventListener("click", (ev) => {
        ev.preventDefault()
        const tabs = [
            "#tabTicket",
            "#tabContato",
            "#tabCliente",
            "#tabIndicadores"
        ]

        tabs.forEach(selector => {
            const tab = document.querySelector(selector);
            if (!tab) return;

            tab.classList.remove("active");
            tab.classList.remove("in");

        });

        document.querySelector("#tabDadosEmpresa").classList.add("active", "in")
    })
}

function formatMinutesToHHMM(totalMinutes) {
    if (totalMinutes == null || isNaN(totalMinutes)) return ""

    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.floor(totalMinutes % 60)

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function abrirModalInserirLink(onConfirm) {
    // remove modal antigo se existir
    const old = document.querySelector("#modal-inserir-link")
    if (old) old.remove()

    const overlay = document.createElement("div")
    overlay.id = "modal-inserir-link"
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
    `

    const modal = document.createElement("div")
    modal.style.cssText = `
        background: #fff;
        padding: 16px;
        border-radius: 8px;
        width: 320px;
        box-shadow: 0 10px 30px rgba(0,0,0,.3);
        display: flex;
        flex-direction: column;
        gap: 10px;
        font-family: Arial, sans-serif;
    `

    modal.innerHTML = `
        <strong>Inserir link</strong>

        <label>
            Texto
            <input id="link-texto" type="text" style="width:100%; padding:6px;">
        </label>

        <label>
            URL
            <input id="link-url" type="url" placeholder="https://..." style="width:100%; padding:6px;">
        </label>

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
            <button id="btn-cancelar">Cancelar</button>
            <button id="btn-confirmar">Confirmar</button>
        </div>
    `

    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    const inputTexto = modal.querySelector("#link-texto")
    const inputUrl = modal.querySelector("#link-url")

    inputTexto.focus()

    modal.querySelector("#btn-cancelar").onclick = () => overlay.remove()

    modal.querySelector("#btn-confirmar").onclick = () => {
        const texto = inputTexto.value.trim()
        const url = inputUrl.value.trim()

        if (!url) {
            alert("Informe a URL")
            return
        }

        onConfirm({ texto, url })
        overlay.remove()
    }

    // fechar clicando fora
    overlay.addEventListener("click", e => {
        if (e.target === overlay) overlay.remove()
    })

    // fechar com ESC
    document.addEventListener("keydown", function esc(e) {
        if (e.key === "Escape") {
            overlay.remove()
            document.removeEventListener("keydown", esc)
        }
    })
}

function decodeHtml(str) {
    return str
        .replace(/\\u003c/g, "<")
        .replace(/\\u003e/g, ">")
        .replace(/\\"/g, '"');
}

async function abrirModalXML(src) {

    let modal = document.querySelector("#modal-preview-xml")
    if (modal) modal.remove()

    modal = document.createElement("div")

    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.85);
        z-index: 99999;
        display:flex;
        align-items:center;
        justify-content:center;
    `

    const container = document.createElement("div")

    container.style.cssText = `
        width:85%;
        height:90%;
        background:#1e1e1e;
        overflow:auto;
        border-radius:8px;
        padding:20px;
        color:#ddd;
        font-family: monospace;
    `

    container.innerHTML = "Carregando XML..."

    modal.appendChild(container)
    document.body.appendChild(modal)

    try {

        const response = await fetch(src)
        const xmlText = await response.text()

        const formatted = formatXML(xmlText)

        container.innerHTML = `
<pre style="
font-size:14px;
line-height:1.6;
white-space:pre;
color:#000000;
">${formatted.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre>
`

    } catch (err) {

        container.innerHTML = "Erro ao carregar XML"

    }

    modal.addEventListener("click", e => {
        if (e.target === modal) modal.remove()
    })

}

function abrirModalImagem(src) {
    let modal = document.querySelector("#modal-preview-imagem");
    if (modal) modal.remove();

    modal = document.createElement("div");
    modal.id = "modal-preview-imagem";
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.85);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
        -ms-user-select: none;
        cursor: grab;
    `;

    const img = document.createElement("img");
    img.src = src;
    img.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        user-select: none;
        -webkit-user-drag: none;
        pointer-events: auto;
        will-change: transform;
        cursor: grab;
    `;

    // 🔒 bloqueia drag nativo TOTAL (imagem + modal)
    [modal, img].forEach(el => {
        el.draggable = false;
        el.addEventListener("dragstart", e => e.preventDefault());
    });

    let scale = 1;
    let translateX = 0;
    let translateY = 0;

    let isDragging = false;
    let startX = 0;
    let startY = 0;

    function atualizarTransform() {
        img.style.transform =
            `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    modal.addEventListener("wheel", e => {
        e.preventDefault();

        const rect = modal.getBoundingClientRect();

        const mouseX = e.clientX - (rect.left + rect.width / 2);
        const mouseY = e.clientY - (rect.top + rect.height / 2);

        const prevScale = scale;

        scale += e.deltaY * -0.0025;
        scale = Math.min(Math.max(0.5, scale), 5);

        translateX -= mouseX * (scale / prevScale - 1);
        translateY -= mouseY * (scale / prevScale - 1);

        atualizarTransform();
    }, { passive: false });

    modal.addEventListener("mousedown", e => {
        if (e.button !== 0) return;
        e.preventDefault(); // 👈 BLOQUEIA drag fantasma
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        modal.style.cursor = "grabbing";
        img.style.cursor = "grabbing";
    });

    window.addEventListener("mousemove", e => {
        if (!isDragging) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        atualizarTransform();
    });

    window.addEventListener("mouseup", () => {
        isDragging = false;
        modal.style.cursor = "grab";
        img.style.cursor = "grab";
    });

    modal.addEventListener("click", e => {
        if (e.target === modal) modal.remove();
    });

    document.addEventListener("keydown", function escListener(e) {
        if (e.key === "Escape") {
            modal.remove();
            document.removeEventListener("keydown", escListener);
        }
    });

    atualizarTransform();
    modal.appendChild(img);
    document.body.appendChild(modal);
}

function abrirModalVideo(src) {
    let modal = document.querySelector("#modal-preview-video");
    if (modal) modal.remove();

    modal = document.createElement("div");
    modal.id = "modal-preview-video";
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.85);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    const video = document.createElement("video");
    video.src = src;
    video.controls = true;
    video.autoplay = true;
    video.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        background: black;
    `;

    modal.appendChild(video);

    modal.addEventListener("click", e => {
        if (e.target === modal) modal.remove();
    });

    document.addEventListener("keydown", function escListener(e) {
        if (e.key === "Escape") {
            modal.remove();
            document.removeEventListener("keydown", escListener);
        }
    });

    document.body.appendChild(modal);
}

function createButtonLink() {
    const insertLinkButton = document.createElement("a")
    insertLinkButton.className = "btn btn-sm btn-success"
    insertLinkButton.title = "Inserir link"
    insertLinkButton.innerHTML = `<i class="ace-icon fa fa-link"></i>`

    document.querySelectorAll(".btn.btn-sm.btn-purple")[1].parentNode.insertBefore(insertLinkButton, document.querySelector(".btn.btn-sm.btn-purple").nextSibling);

    let savedRange = null;

    insertLinkButton.addEventListener("click", e => {
        e.preventDefault()

        const selection = window.getSelection()
        if (selection.rangeCount > 0) {
            savedRange = selection.getRangeAt(0).cloneRange()
        }

        abrirModalInserirLink(({ texto, url }) => {
            const editor = document.querySelector("#EditorTramite")
            editor.focus()

            if (!savedRange) return

            const selection = window.getSelection()
            selection.removeAllRanges()
            selection.addRange(savedRange)

            const range = selection.getRangeAt(0)
            range.deleteContents()

            const link = document.createElement("a")
            link.href = url
            link.target = "_blank"
            link.rel = "noopener noreferrer"
            link.innerText = texto || url
            link.contentEditable = "false"

            const space = document.createTextNode(" ")

            range.insertNode(link)
            range.insertNode(space)

            // move o cursor para depois do espaço
            range.setStartAfter(space)
            range.setEndAfter(space)
            selection.removeAllRanges()
            selection.addRange(range)


            savedRange = null
        })
    })
}

async function abrirModalTXT(src) {

    let modal = document.querySelector("#modal-preview-txt")
    if (modal) modal.remove()

    modal = document.createElement("div")

    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.85);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
    `

    const container = document.createElement("div")

    container.style.cssText = `
        width: 90%;
        height: 90%;
        background: white;
        overflow: auto;
        border-radius: 6px;
        padding: 10px;
        display: flex;
        flex-direction: column;
    `

    // barra superior
    const toolbar = document.createElement("div")
    toolbar.style.cssText = `
        display: flex;
        gap: 8px;
        margin-bottom: 10px;
    `

    const btnAumentar = document.createElement("button")
    btnAumentar.textContent = "A+"

    const btnDiminuir = document.createElement("button")
    btnDiminuir.textContent = "A-"

    toolbar.appendChild(btnAumentar)
    toolbar.appendChild(btnDiminuir)

    const pre = document.createElement("pre")

    pre.style.cssText = `
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 14px;
        line-height: 1.6;
        font-family: monospace;
        background: #f8f8f8;
        padding: 10px;
        border-radius: 6px;
        flex: 1;
    `

    let fontSize = 14

    btnAumentar.onclick = () => {
        fontSize += 2
        pre.style.fontSize = fontSize + "px"
    }

    btnDiminuir.onclick = () => {
        if (fontSize > 8) {
            fontSize -= 2
            pre.style.fontSize = fontSize + "px"
        }
    }

    container.appendChild(toolbar)
    container.appendChild(pre)

    modal.appendChild(container)
    document.body.appendChild(modal)

    try {

        const response = await fetch(src)
        const text = await response.text()

        pre.textContent = text

    } catch (err) {

        pre.textContent = "Erro ao carregar arquivo"

    }

    modal.addEventListener("click", e => {
        if (e.target === modal) modal.remove()
    })

}

async function abrirModalPDF(src) {
    let modal = document.querySelector("#modal-preview-pdf");
    if (modal) modal.remove();

    modal = document.createElement("div");
    modal.id = "modal-preview-pdf";
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.85);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    try {
        const response = await fetch(src);
        const blob = await response.blob();
        const pdfUrl = URL.createObjectURL(blob);

        const frame = document.createElement("iframe");
        frame.src = pdfUrl;

        frame.style.cssText = `
            width: 90%;
            height: 90%;
            border: none;
            background: white;
            border-radius: 4px;
        `;

        modal.appendChild(frame);
    } catch (err) {
        modal.innerHTML = `
            <div style="background:white;padding:20px;border-radius:6px;">
                Erro ao carregar PDF
            </div>
        `;
    }

    modal.addEventListener("click", e => {
        if (e.target === modal) modal.remove();
    });

    document.addEventListener("keydown", function escListener(e) {
        if (e.key === "Escape") {
            modal.remove();
            document.removeEventListener("keydown", escListener);
        }
    });

    document.body.appendChild(modal);
}

async function abrirModalDOCX(src) {

    let modal = document.querySelector("#modal-preview-docx")
    if (modal) modal.remove()

    modal = document.createElement("div")

    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.85);
        z-index: 99999;
        display:flex;
        align-items:center;
        justify-content:center;
    `

    const container = document.createElement("div")

    container.style.cssText = `
        width: 70%;
        height: 85%;
        background:white;
        overflow:auto;
        border-radius:8px;
        padding:30px;
        font-family: Arial, sans-serif;
        line-height:1.6;
    `

    container.innerHTML = "Carregando documento..."

    modal.appendChild(container)
    document.body.appendChild(modal)

    try {

        const response = await fetch(src)
        const arrayBuffer = await response.arrayBuffer()

        const result = await mammoth.convertToHtml({ arrayBuffer })

        container.innerHTML = `
        <style>
        .docx-preview h1,h2,h3{
            margin-top:20px;
        }

        .docx-preview p{
            margin:10px 0;
        }

        .docx-preview table{
            border-collapse:collapse;
        }

        .docx-preview td,.docx-preview th{
            border:1px solid #ccc;
            padding:6px 10px;
        }
        </style>

        <div class="docx-preview">
        ${result.value}
        </div>
        `

    } catch (err) {

        container.innerHTML = "Erro ao abrir documento"

    }

    modal.addEventListener("click", e => {
        if (e.target === modal) modal.remove()
    })

}

async function abrirModalExcel(src) {

    let modal = document.querySelector("#modal-preview-excel")
    if (modal) modal.remove()

    modal = document.createElement("div")

    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.85);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
    `

    const container = document.createElement("div")

    container.style.cssText = `
        width: 95%;
        height: 90%;
        background: white;
        overflow: auto;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 10px 30px rgba(0,0,0,.4);
    `

    container.innerHTML = "Carregando planilha..."

    modal.appendChild(container)
    document.body.appendChild(modal)

    try {

        const response = await fetch(src)
        const blob = await response.arrayBuffer()

        const workbook = XLSX.read(blob)

        const sheet = workbook.Sheets[workbook.SheetNames[0]]

        const html = XLSX.utils.sheet_to_html(sheet)

        container.innerHTML = `
        <style>

        .excel-preview{
            width:100%;
            overflow:auto;
        }

        .excel-preview table{
            border-collapse: collapse;
            font-family: Arial, sans-serif;
            font-size: 13px;
            min-width: 100%;
        }

        .excel-preview th{
            background:#1d6f42;
            color:white;
            position:sticky;
            top:0;
            z-index:2;
        }

        .excel-preview td,
        .excel-preview th{
            border:1px solid #dcdcdc;
            padding:6px 10px;
            white-space:nowrap;
        }

        .excel-preview tr:nth-child(even){
            background:#f7f7f7;
        }

        .excel-preview tr:hover{
            background:#e6f2ff;
        }

        </style>

        <div class="excel-preview">
        ${html}
        </div>
        `

    } catch (err) {

        container.innerHTML = `
        <div style="font-family:Arial;padding:20px;">
            Erro ao carregar planilha
        </div>
        `

    }

    modal.addEventListener("click", e => {
        if (e.target === modal) modal.remove()
    })

}

function createImagesView() {
    const wait = setInterval(() => {
        const buttons = document.querySelectorAll(".anexosTramite");
        if (!buttons.length) return;

        clearInterval(wait);

        buttons.forEach(button => {
            const idTramite = button.dataset.idtramite;
            if (!idTramite) return;

            const tramiteDiv = button.closest(".itemdiv");
            if (!tramiteDiv) return;

            const url = `https://portaldocliente.praxio.com.br/Ticket/TicketTramitesAnexos?id_tramite=${idTramite}`;

            fetch(url)
                .then(r => r.text())
                .then(raw => {
                const html = decodeHtml(raw);

                const template = document.createElement("template");
                template.innerHTML = html.trim();

                const anexos = template.content.querySelectorAll("a");

                anexos.forEach(a => {
                    const nome = a.querySelector("label")?.innerText || "";
                    const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(nome);
                    const isVideo = /\.(mp4|webm|mov|ogg)$/i.test(nome);
                    const isPDF = /\.pdf$/i.test(nome);
                    const isTXT = /\.txt$/i.test(nome);
                    const isExcel = /\.(xlsx|xls)$/i.test(nome);
                    const isDOCX = /\.docx$/i.test(nome)
                    const isXML = /\.xml$/i.test(nome)

                    if (!isImage && !isVideo && !isPDF && !isTXT && !isExcel && !isDOCX && !isXML) return

                    const href = a.getAttribute("href");
                    const urlImagem = new URL(href, location.origin).href;

                    fetch(urlImagem)
                        .then(r => r.blob())
                        .then(blob => {
                        const imgUrl = URL.createObjectURL(blob);

                        let container = tramiteDiv.querySelector(".body");

                        if (!container) {
                            container = document.createElement("div");
                            container.className = "preview-anexos";
                            container.style.marginTop = "8px";
                            container.style.display = "flex";
                            container.style.gap = "8px";
                            container.style.flexWrap = "wrap";
                            tramiteDiv.appendChild(container);
                        }

                        if (isImage) {
                            const img = document.createElement("img");
                            img.src = imgUrl;
                            img.title = nome;
                            img.style.marginTop = "10px";
                            img.style.maxWidth = "125px";
                            img.style.maxHeight = "125px";
                            img.style.cursor = "pointer";
                            img.style.border = "1px solid #ccc";
                            img.style.borderRadius = "4px";
                            img.style.userSelect = "none";

                            img.onclick = () => abrirModalImagem(imgUrl);

                            container.appendChild(img);
                        }

                        if (isVideo) {
                            const video = document.createElement("video");
                            video.src = imgUrl;
                            video.title = nome;
                            video.muted = true;
                            video.loop = true;
                            video.autoplay = true;

                            video.style.marginTop = "10px";
                            video.style.maxWidth = "80px";
                            video.style.maxHeight = "80px";
                            video.style.cursor = "pointer";
                            video.style.border = "1px solid #ccc";
                            video.style.borderRadius = "4px";

                            video.onclick = () => abrirModalVideo(imgUrl);

                            container.appendChild(video);
                        }

                        if (isPDF) {
                            const pdf = document.createElement("div");

                            pdf.innerHTML = `<i class="fa fa-file-pdf-o"></i>`;
                            pdf.title = nome;

                            pdf.style.cssText = `
                                        margin-top: 10px;
                                        width: 40px;
                                        height: 40px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        font-size: 26px;
                                        color: #d9534f;
                                        background: #f8f8f8;
                                        border: 1px solid #ccc;
                                        border-radius: 4px;
                                        cursor: pointer;
                                    `;

                            pdf.onclick = () => abrirModalPDF(urlImagem);

                            container.appendChild(pdf);
                        }

                        if (isTXT) {
                            const txt = document.createElement("div");

                            txt.innerHTML = `<i class="fa fa-file-text-o"></i>`;
                            txt.title = nome;

                            txt.style.cssText = `
                                        margin-top: 10px;
                                        width: 40px;
                                        height: 40px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        font-size: 26px;
                                        color: #777;
                                        background: #f8f8f8;
                                        border: 1px solid #ccc;
                                        border-radius: 4px;
                                        cursor: pointer;
                                    `;

                            txt.onclick = () => abrirModalTXT(urlImagem);

                            container.appendChild(txt);
                        }

                        if (isExcel) {

                            const excel = document.createElement("div")

                            excel.innerHTML = `<i class="fa fa-file-excel-o"></i>`
                                    excel.title = nome

                            excel.style.cssText = `
                                        margin-top: 10px;
                                        width: 40px;
                                        height: 40px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        font-size: 26px;
                                        color: #1d6f42;
                                        background: #f8f8f8;
                                        border: 1px solid #ccc;
                                        border-radius: 4px;
                                        cursor: pointer;
                                    `

                                    excel.onclick = () => abrirModalExcel(urlImagem)

                            container.appendChild(excel)

                        }

                        if (isDOCX) {

                            const docx = document.createElement("div")

                            docx.innerHTML = `<i class="fa fa-file-word-o"></i>`
                                    docx.title = nome

                            docx.style.cssText = `
                                        margin-top:10px;
                                        width:40px;
                                        height:40px;
                                        display:flex;
                                        align-items:center;
                                        justify-content:center;
                                        font-size:26px;
                                        color:#2b579a;
                                        background:#f8f8f8;
                                        border:1px solid #ccc;
                                        border-radius:4px;
                                        cursor:pointer;
                                    `

                                    docx.onclick = () => abrirModalDOCX(urlImagem)

                            container.appendChild(docx)
                        }

                        if (isXML) {

                            const xml = document.createElement("div")

                            xml.innerHTML = `<i class="fa fa-code"></i>`
    xml.title = nome

                            xml.style.cssText = `
        margin-top:10px;
        width:40px;
        height:40px;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:26px;
        color:#e67e22;
        background:#f8f8f8;
        border:1px solid #ccc;
        border-radius:4px;
        cursor:pointer;
    `

    xml.onclick = () => abrirModalXML(urlImagem)

                            container.appendChild(xml)

                        }
                    });
                });
            });
        });
    }, 1000);
}

function insertSLA() {
    let slaList = JSON.parse(localStorage.getItem("sla-list"))
    const idTicket = window.location.href.split("https://portaldocliente.praxio.com.br/Ticket/TicketPrincipal/")[1].replace("#", "");

    let ticket = slaList.find(ticket => ticket.idTicket == idTicket)
    let ticketSLA = `SLA: ${formatMinutesToHHMM(ticket.sla)}`

    const sla_span = document.createElement("span")
    sla_span.style = `margin-right: 15px; font-size: 14px; color: ${(ticket?.sla / 60) < 15 ? 'green' : (ticket?.sla / 60) < 23 ? 'blue' : 'red'}; font-weight: bold;`
    sla_span.innerText = ticketSLA

    document.querySelector("#btnIA").parentNode.insertBefore(sla_span, document.querySelector("#btnIA"));

}

function createCommentField() {
    const target = document.querySelector("#tramiteAtual").parentElement

    const commentField = `<div class="widget-box widget-color-dark powertour-hook powertour-highlight" style="padding: 0;">
    <div id="cabecalhoTramite" class="widget-header widget-header-small" style="display: flex; flex-direction: row-reverse; align-items: center;padding:  5px !important;">
        <button id="send-comment" class="btn btn-success" style="border: none !important;">Salvar Comentário</button>
    </div>
    <div class="widget-body">
        <div class="widget-main no-padding">
            <div id="EditorTramiteResizable" class="ui-resizable" style="max-height: 250px;">
                <div id="commentEditor" class="wysiwyg-editor bdcTramite" style="min-height: 100px; width: 98%; height: 98%; max-height: 150px;" contenteditable="true"><br>
                </div>
                <div class="ui-resizable-handle ui-resizable-e" style="z-index: 90;"></div>
            </div>
        </div>

        <div>
            <div class="centraliza">
                <div id="divAnexo" style="display: none">
                    <a href="#" id="btnUpload" class="btn btn-light" data-toggle="modal" data-target="#myModal" title="Anexos">
                        <i class="ace-icon fa fa-paperclip "></i><span id="totalArquivos" class="badge badge-success">0</span>
                    </a>
                </div>
                <div id="divOpcoesTramite" class="btn-group centraliza" style="display: none">
                    <label id="lblPrivado" for="chkPrivado">Privado</label>
                    <input id="chkPrivado" name="chkPrivado" class="ace ace-switch ace-switch-5" type="checkbox">
                    <span id="spanPrivado" class="lbl"></span>
                </div>


            </div>

            <span class="field-validation-valid" data-valmsg-for="TramiteMlo.Descricao" data-valmsg-replace="true"></span>
        </div>
    </div>

</div>`

    target.insertAdjacentHTML("beforeend", commentField)

    document.querySelector("#send-comment").addEventListener("click", async (ev) => {
        ev.preventDefault()
        await saveComment()
    })
}

async function saveComment() {
    const comment = document.querySelector("#commentEditor").innerText
    const sender = document.querySelector("#spanNomeAbreviado").innerText
    const currentUrl = location.href
    const idTicket = currentUrl.split("/Ticket/TicketPrincipal/")[1].replace("#", "")

    if (!comment.trim() || !idTicket) return

    try {
        const response = await fetch(
            `https://portal-livid-five.vercel.app/api/updateComment`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    idTicket: idTicket,
                    comment: comment,
                    sender: sender
                })
            }
        )

        if (!response.ok) {
            const errorBody = await response.text()
            throw new Error(`HTTP ${response.status}: ${errorBody}`)
        }
    } catch (err) {
        console.log(err)
    }
}

async function insertComment() {
    const currentUrl = location.href
    const idTicket = currentUrl.split("/Ticket/TicketPrincipal/")[1].replace("#", "")

    try {
        const response = await fetch(
            `https://portal-livid-five.vercel.app/api/getComments?idTicket=${idTicket}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            }
        )

        if (!response.ok) {
            const errorBody = await response.text()
            throw new Error(`HTTP ${response.status}: ${errorBody}`)
        }

        const data = await response.json()

        if (!data) return
        document.querySelector("#commentEditor").innerText = data[0].comentario
    } catch (err) {
        console.log(err)
    }
}

(async function () {
    'use strict';
    await createTabEmpresa()
    createTabButton()

    //document.body.style = "overflow-y: hidden;"
    //document.querySelector("#main-container").style = "overflow-y: scroll;"
    createCommentField()
    await insertComment()
    createButtonLink()
    createImagesView()

    insertSLA()
})();
