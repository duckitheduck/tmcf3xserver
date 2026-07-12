const express = require("express");
const app = express();

// Replace these with your real data sources
let serverData = [];
let logData = [];

app.get("/servers", (req, res) => {
    res.json(serverData);
});

app.get("/logs", (req, res) => {
    res.json(logData);
});

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;
const ROBLOX_UNIVERSE_ID = "YOUR_UNIVERSE_ID"; // replace with your real universe ID

app.post("/announcement", async (req, res) => {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Missing message" });
    }

    try {
        const response = await fetch(
            `https://apis.roblox.com/messaging-service/v1/universes/${ROBLOX_UNIVERSE_ID}/topics/announcement`,
            {
                method: "POST",
                headers: {
                    "x-api-key": ROBLOX_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ message }),
            }
        );

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Roblox API error: ${response.status} ${text}`);
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Failed to publish announcement:", err);
        res.status(500).json({ error: "Failed to send announcement" });
    }
});

// Serve your frontend files (index.html, script.js, etc.)
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
