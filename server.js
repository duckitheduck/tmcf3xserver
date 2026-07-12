const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

let latestMessage = null;

app.get("/", (req, res) => {
    res.send("Roblox HTTP Server is running!");
});

app.get("/message", (req, res) => {
    res.json({
        message: latestMessage
    });

    latestMessage = null;
});

app.post("/message", (req, res) => {
    latestMessage = req.body.message;

    res.json({
        success: true
    });
});

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});
