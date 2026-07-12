const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

let announcement = null;

app.get("/", (req, res) => {
    res.send("Roblox Admin Server Online");
});

// Roblox polls this endpoint
app.get("/announcement", (req, res) => {
    res.json({
        message: announcement
    });

    announcement = null;
});

// You send a message here
app.post("/announcement", (req, res) => {
    announcement = req.body.message;

    res.json({
        success: true
    });
});

app.listen(PORT, () => {
    console.log("Listening on " + PORT);
});

async function update(){

    let servers=await fetch("/servers");
    servers=await servers.json();

    let logs=await fetch("/logs");
    logs=await logs.json();

    document.getElementById("serverCount").innerText=servers.length;

    let players=0;

    document.getElementById("servers").innerHTML="";

    servers.forEach(server=>{

        players+=server.players.length;

        let html=`

<div class="server">

<b>JobId</b><br>

${server.jobId}

<br><br>

<b>Players (${server.players.length})</b><br>

`;

        server.players.forEach(player=>{

            html+=`<div class="player">${player}</div>`;

        });

        html+="</div>";

        document.getElementById("servers").innerHTML+=html;

    });

    document.getElementById("playerCount").innerText=players;

    document.getElementById("logCount").innerText=logs.length;

    document.getElementById("logs").innerHTML="";

    logs.forEach(log=>{

        document.getElementById("logs").innerHTML+=`

<div class="log">

<b>${log.type}</b>

(${log.server})

<br>

${log.text}

<br>

<small>${log.time}</small>

</div>

`;

    });

}

update();

setInterval(update,1000);
