// server.js
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(bodyParser.json());

// POST route
app.post("/api/v1/test", (req, res) => {
  console.log("📩 New POST request received!");
  console.log("Temperature:", req.body.temperature);
  console.log("Humidity:", req.body.humidity);

  res.status(201).json({
    response: "DHT11 data received successfully",
    received: req.body
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
