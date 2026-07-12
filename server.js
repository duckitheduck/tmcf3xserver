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

const API_KEY = process.env.API_KEY;

function authenticate(req, res, next) {
    if (req.headers["x-api-key"] !== API_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    next();
}

app.post("/server/start", authenticate, (req, res) => {
    // ...
});

app.post("/server/join", authenticate, (req, res) => {
    // ...
});

app.post("/server/leave", authenticate, (req, res) => {
    // ...
});

app.post("/server/chat", authenticate, (req, res) => {
    // ...
});
