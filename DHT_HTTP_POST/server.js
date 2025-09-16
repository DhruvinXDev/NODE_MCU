// server.js
const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_b1pdSt6ToBJn@ep-holy-cake-adoaezsz-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  ssl: { rejectUnauthorized: false } // required for Neon
});

// Test route
app.post("/api/v1/test", async (req, res) => {
  try {
    const { temperature, humidity } = req.body;

    if (temperature === undefined || humidity === undefined) {
      return res.status(400).json({ error: "Missing temperature or humidity" });
    }

    // Insert into database
    const result = await pool.query(
      "INSERT INTO dht11_data (temperature, humidity) VALUES ($1, $2) RETURNING *",
      [temperature, humidity]
    );

    console.log("📩 Data stored:", result.rows[0]);

    res.status(201).json({
      response: "DHT11 data stored successfully",
      stored: result.rows[0]
    });
  } catch (error) {
    console.error("❌ Database error:", error);
    res.status(500).json({ error: "Database insert failed" });
  }
});

// Fetch all data
app.get("/api/v1/data", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM dht11_data ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Database fetch error:", error);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
