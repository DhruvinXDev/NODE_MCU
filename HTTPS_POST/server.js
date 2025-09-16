// server.js
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON body
app.use(bodyParser.json());

// Test route
app.post("/api/v1/test", (req, res) => {
  console.log("📩 New POST request received!");
  console.log("Data:", req.body);

  // Send response back to ESP8266
  res.status(201).json({
    response: "Data received successfully",
    received: req.body
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
