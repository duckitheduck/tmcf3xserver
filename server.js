const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

let announcement = null;


// Home / health check
app.get("/", (req, res) => {
    res.send("Roblox message HTTP script online");
});


// Roblox polls this endpoint
app.get("/announcement", (req, res) => {

    const message = announcement;

    // Clear after sending
    announcement = null;

    res.json({
        message: message
    });

});


// Website sends a message here
app.post("/announcement", (req, res) => {

    const message = req.body?.message;

    if (typeof message !== "string" || message.trim() === "") {
        return res.status(400).json({
            success: false,
            error: "Message is required"
        });
    }

    announcement = message;

    console.log("Announcement received:", message);

    res.json({
        success: true
    });

});


// Test route
app.get("/test", (req, res) => {
    res.send("Test route works");
});


// Start server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Roblox message HTTP server running on port ${PORT}`);
});
