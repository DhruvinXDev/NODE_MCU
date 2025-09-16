// server.js
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
