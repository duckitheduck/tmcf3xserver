function escapeHTML(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const el = {
    serverCount: document.getElementById("serverCount"),
    playerCount: document.getElementById("playerCount"),
    logCount: document.getElementById("logCount"),
    servers: document.getElementById("servers"),
    logs: document.getElementById("logs"),
};

let updating = false;

async function update() {
    if (updating) return; // avoid overlapping runs if a fetch is slow
    updating = true;
    try {
        const [serverRes, logRes] = await Promise.all([
            fetch("/servers"),
            fetch("/logs"),
        ]);
        if (!serverRes.ok || !logRes.ok) throw new Error("Bad response");

        const servers = await serverRes.json();
        const logs = await logRes.json();

        el.serverCount.innerText = servers.length;

        let players = 0;
        const serverHtml = servers.map(server => {
            players += server.players.length;
            const playerHtml = server.players
                .map(player => `<div class="player">${escapeHTML(player)}</div>`)
                .join("");
            return `
<div class="server">
<b>JobId</b><br>
${escapeHTML(server.jobId)}
<br><br>
<b>Players (${server.players.length})</b><br>
${playerHtml}
</div>`;
        }).join("");
        el.servers.innerHTML = serverHtml;

        el.playerCount.innerText = players;
        el.logCount.innerText = logs.length;

        const logHtml = logs.map(log => `
<div class="log">
<b>${escapeHTML(log.type)}</b>
(${escapeHTML(log.server)})
<br>
${escapeHTML(log.text)}
<br>
<small>${escapeHTML(log.time)}</small>
</div>`).join("");
        el.logs.innerHTML = logHtml;

    } catch (err) {
        console.error("update() failed:", err);
    } finally {
        updating = false;
    }
}

update();
setInterval(update, 1000);
