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

// Serve your frontend files (index.html, script.js, etc.)
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
