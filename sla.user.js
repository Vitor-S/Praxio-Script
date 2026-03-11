// ==UserScript==
// @name         Script SLA
// @namespace
// @version      1.0.4
// @description  Utilitários para o portal do cliente Praxio com múltiplos atalhos
// @author       Vitor
// @match        https://portaldocliente.praxio.com.br/Ticket*
// @require      file:///C:/Users/Vitor/Projetos/UserScript/portalService.js
// @require      file:///C:/Users/Vitor/Projetos/UserScript/shortcuts.js
// @run-at       document-idle
// @grant        GM_addStyle
// ==/UserScript==

function formatMinutesToHHMM(totalMinutes) {
    if (totalMinutes == null || isNaN(totalMinutes)) return ""

    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.floor(totalMinutes % 60)

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

async function updateAllSLA() {
    const rows = document.querySelectorAll(".dxgvDataRow_Metropolis")
    const loadingScreen = document.getElementById("loadingScreen")

    loadingScreen.style.display = "flex"
    for (const row of rows) {
        const link = row.querySelector("a")
        if (!link) continue

        const idTicket = link.href.split("/Ticket/TicketPrincipal/")[1]
        await updateTicketSLA(idTicket, false)
    }
    loadingScreen.style.display = "none"

    location.reload()
}

function updateSLAList(ticketData, reload = true) {
    if (!ticketData?.idTicket) return

    const slaList = JSON.parse(localStorage.getItem("sla-list")) || []

    const index = slaList.findIndex(
        item => item.idTicket == ticketData.idTicket
    )

    if (index !== -1) {
        slaList[index] = {
            ...slaList[index],
            ...ticketData
        }
    } else {
        slaList.push(ticketData)
    }

    localStorage.setItem("sla-list", JSON.stringify(slaList))
    if (reload) location.reload()
}

async function updateToken(idTicket) {
    try {
        const response = await fetch(
            "https://portal-livid-five.vercel.app/api/login",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    user: "vitor.oliveira",
                    password: "14191821@VSoX"
                })
            }
        )

        if (!response.ok) {
            throw new Error("Erro ao fazer login")
        }

        const data = await response.json()

        localStorage.setItem("token", data.token)
        console.log("Erro ao calcular SLA. Atualizando token e tentando novamente...")
        await updateTicketSLA(idTicket)

        return data.token

    } catch (err) {
        console.error("Erro updateToken:", err)
        return null
    }
}

async function updateTicketSLA(idTicket, reload = true) {
    try {
        const token = localStorage.getItem("token")

        const response = await fetch(
            `https://portal-livid-five.vercel.app/api/sla?idTicket=${idTicket}`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            }
        )

        if (!response.ok) {
            const errorBody = await response.text()
            throw new Error(`HTTP ${response.status}: ${errorBody}`)
        }

        const data = await response.json()
        updateSLAList(data, reload)

    } catch (err) {
        await updateToken(idTicket)
    }
}

function getSlaColumnIndex() {
    const header = document.querySelector("#grdTicket_DXHeadersRow0")
    if (!header) return null

    const heads = header.querySelectorAll(":scope > td")

    const slaTargetIndex = Array.from(heads).findIndex(
        head => head.innerText.trim() === "Previsão de Entrega"
    )

    /*if (slaTargetIndex === -1) {
        alert("Você deve adicionar a coluna Previsão de Entrega")
        return null
    }*/

    heads[slaTargetIndex].innerText = "Tempo SLA"
    return slaTargetIndex
}

function createUpdateAllSlaButton() {
    const targetElement = document.querySelector(".page-header")
    targetElement.style = "display: flex; align-items: center; justify-content: space-between;"

    const button = document.createElement("button")
    button.id = "btnUpdateAllSLA"
    button.classList.add("btn", "btn-primary", "btn-white")
    button.innerText = "Atualizar Todos SLA"
    button.addEventListener("click", updateAllSLA)

    targetElement.appendChild(button)
}

async function setTicketsSla(column) {
    if (column === null) return

    const rows = document.querySelectorAll(".dxgvDataRow_Metropolis")

    rows.forEach(row => {
        const link = row.querySelector("a")
        if (!link) return

        const slaList = JSON.parse(localStorage.getItem("sla-list")) || []

        const idTicket = link.href.split("/Ticket/TicketPrincipal/")[1]
        const tdTarget = row.querySelectorAll(":scope > td")[column]
        if (!tdTarget) return

        const ticketData = slaList.find(ticket => ticket.idTicket == idTicket)

        tdTarget.innerHTML = `
            <button id="btnReloadSLA" type="button" class="btn btn-xs btn-white" style="display: flex; align-items: center; justify-content: center; gap: 5px; width: 100%; height: 100%; border: none; color: ${(ticketData?.sla / 60) < 15 ? 'green' : (ticketData?.sla / 60) < 23 ? 'blue' : 'red'} !important;">
               ${ticketData?.sla ? formatMinutesToHHMM(ticketData.sla) : ""}
            </button>`

        const btn = tdTarget.querySelector("button")
        btn.parentElement.style = "padding: 0; height: 24px;"

        btn.addEventListener("click", async (e) => {
            await updateTicketSLA(idTicket)
        })
    })
}

function createLoadingScreen() {
    const loadingScreen = document.createElement("div")
    loadingScreen.id = "loadingScreen"
    loadingScreen.style = `
        position: fixed;
        width: 100%;
        height: 100%;
        z-index: 9999;
        top: 0;
        left: 0;
        background-color: rgba(255, 255, 255, 0.8);
        display: none;
        align-items: center;
        justify-content: center;
    `
    loadingScreen.innerHTML = `
        <i class="fa fa-spinner fa-spin" style="
            font-size: 25px;
            color: #333;
            animation: fa-spin 0.6s infinite linear;
        "></i>
    `
    document.body.appendChild(loadingScreen)
}

(async function () {
    'use strict'

    const currentUrl = location.href

    if(currentUrl.includes("/Ticket/TicketPrincipal/")){
        const idTicket = currentUrl.split("/Ticket/TicketPrincipal/")[1].replace("#", "")
        await updateTicketSLA(idTicket, false)
        return
    }

    createLoadingScreen()
    createUpdateAllSlaButton()

    const slaTargetIndex = getSlaColumnIndex()
    setTimeout(() => {
        setTicketsSla(slaTargetIndex)
    }, 2000)
})();


(function interceptNetwork() {

    const TARGET_URLS = [
        "/Ticket/PesquisaPartial"
    ]

    function matchUrl(url) {
        return typeof url === "string" &&
            TARGET_URLS.some(endpoint => url.includes(endpoint))
    }

    function onMatch() {
        setTimeout(() => {
            setTicketsSla(getSlaColumnIndex())
        }, 1500)
    }

    /* ================= FETCH ================= */
    const originalFetch = window.fetch

    window.fetch = async function (...args) {
        const url = args[0]

        if (matchUrl(url)) {
            onMatch()
        }

        return originalFetch.apply(this, args)
    }

    /* ================= XHR ================= */
    const originalOpen = XMLHttpRequest.prototype.open

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        if (matchUrl(url)) {
            onMatch()
        }

        return originalOpen.call(this, method, url, ...rest)
    }

})();

