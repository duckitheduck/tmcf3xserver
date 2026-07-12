const express = require("express");

const app = express();

app.use(express.json());
app.use(express.static("public"));

const servers = {};

app.post("/server/start", (req, res) => {
    const { jobId, placeId } = req.body;

    servers[jobId] = {
        placeId,
        players: []
    };

    res.json({ success: true });
});

app.post("/player/join", (req, res) => {
    const { jobId, player } = req.body;

    if (servers[jobId]) {
        servers[jobId].players.push(player);
    }

    res.json({ success: true });
});

app.post("/player/leave", (req, res) => {
    const { jobId, player } = req.body;

    if (servers[jobId]) {
        servers[jobId].players =
            servers[jobId].players.filter(p => p !== player);
    }

    res.json({ success: true });
});
