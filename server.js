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
