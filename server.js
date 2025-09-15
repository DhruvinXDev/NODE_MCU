// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization']
}));

// Configuration
const API_KEY = process.env.API_KEY;
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Validate environment variables
if (!API_KEY) {
  console.error('ERROR: API_KEY is not set in .env file');
  process.exit(1);
}

// In-memory storage (replace with database in production)
const devices = {
  // Pre-registered devices
  "DEADBEEF0001": { 
    name: "Greenhouse_Node_1", 
    location: "Greenhouse-01",
    registeredAt: new Date().toISOString()
  },
  "C4D8D539D335": { 
    name: "Greenhouse_Node_1", 
    location: "Greenhouse-01",
    registeredAt: new Date().toISOString()
  }
};

const sensorData = [];
const connectionLogs = [];

// Utility functions
const logConnection = (req, status, message) => {
  const log = {
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'] || 'Unknown',
    status,
    message,
    apiKey: req.headers['x-api-key'] ? 'Present' : 'Missing'
  };
  connectionLogs.push(log);
  
  // Keep only last 100 logs
  if (connectionLogs.length > 100) {
    connectionLogs.shift();
  }
  
  console.log(`[${log.timestamp}] ${status}: ${message} - IP: ${log.ip}`);
};

// Middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Routes

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'IoT Sensor Data API',
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: 'GET /',
      data: 'POST /api/data',
      devices: 'GET /api/devices',
      sensor_data: 'GET /api/data',
      logs: 'GET /api/logs',
      stats: 'GET /api/stats'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: NODE_ENV
  });
});

// Main data endpoint - receives sensor data
app.post('/api/data', (req, res) => {
  try {
    const apikey = req.headers['x-api-key'];
    const clientIP = req.ip || req.connection.remoteAddress;
    
    console.log('\n=== Incoming Request ===');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Client IP:', clientIP);
    
    // Check API key
    if (!apikey) {
      logConnection(req, 'ERROR', 'Missing API key');
      return res.status(401).json({ 
        error: 'Missing API key',
        message: 'Include X-API-Key header with your request'
      });
    }
    
    if (apikey !== API_KEY) {
      logConnection(req, 'ERROR', 'Invalid API key');
      return res.status(401).json({ 
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      });
    }
    
    // Validate request body
    const { device_id, device_name, sensor, temperature, humidity, ts } = req.body;
    
    if (!device_id || !sensor || temperature === undefined || humidity === undefined) {
      logConnection(req, 'ERROR', 'Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['device_id', 'sensor', 'temperature', 'humidity'],
        received: { device_id, sensor, temperature, humidity },
        message: 'Please provide all required fields'
      });
    }
    
    // Validate data types
    const temp = parseFloat(temperature);
    const hum = parseFloat(humidity);
    
    if (isNaN(temp) || isNaN(hum)) {
      logConnection(req, 'ERROR', 'Invalid data types');
      return res.status(400).json({ 
        error: 'Invalid data types',
        message: 'Temperature and humidity must be valid numbers',
        received: { temperature, humidity }
      });
    }
    
    // Validate ranges (optional but recommended)
    if (temp < -50 || temp > 100 || hum < 0 || hum > 100) {
      logConnection(req, 'WARNING', 'Data outside expected ranges');
      console.log('WARNING: Sensor values outside typical ranges');
    }
    
    // Auto-register unknown devices
    if (!devices[device_id]) {
      devices[device_id] = { 
        name: device_name || `Device-${device_id}`, 
        location: 'Unknown',
        registeredAt: new Date().toISOString(),
        autoRegistered: true
      };
      console.log(`Auto-registered new device: ${device_id}`);
      logConnection(req, 'INFO', `New device registered: ${device_id}`);
    }
    
    // Create data entry
    const entry = {
      id: Date.now() + Math.random().toString(36).substr(2, 9), // Simple ID
      device_id,
      device_meta: devices[device_id],
      sensor,
      temperature: temp,
      humidity: hum,
      timestamp: ts || new Date().toISOString(),
      received_at: new Date().toISOString(),
      client_ip: clientIP
    };
    
    // Store data
    sensorData.push(entry);
    
    // Keep only last 1000 entries to prevent memory overflow
    if (sensorData.length > 1000) {
      sensorData.shift();
    }
    
    logConnection(req, 'SUCCESS', `Data received from ${device_id}`);
    console.log('✓ Data stored successfully:', entry);
    
    res.status(200).json({ 
      success: true, 
      message: 'Data received successfully',
      entry_id: entry.id,
      device_id: entry.device_id,
      timestamp: entry.received_at
    });
    
  } catch (error) {
    console.error('Error processing request:', error);
    logConnection(req, 'ERROR', `Server error: ${error.message}`);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Please try again later'
    });
  }
});

// Get all registered devices
app.get('/api/devices', (req, res) => {
  try {
    res.json({
      success: true,
      count: Object.keys(devices).length,
      devices: devices
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get sensor data with optional filtering
app.get('/api/data', (req, res) => {
  try {
    const { device_id, limit = 50, offset = 0 } = req.query;
    
    let filteredData = sensorData;
    
    // Filter by device if requested
    if (device_id) {
      filteredData = sensorData.filter(entry => entry.device_id === device_id);
    }
    
    // Apply pagination
    const startIndex = parseInt(offset);
    const limitNum = Math.min(parseInt(limit), 500); // Max 500 records
    const paginatedData = filteredData.slice(startIndex, startIndex + limitNum);
    
    res.json({
      success: true,
      total: filteredData.length,
      returned: paginatedData.length,
      offset: startIndex,
      limit: limitNum,
      data: paginatedData.reverse() // Most recent first
    });
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get connection logs (for debugging)
app.get('/api/logs', (req, res) => {
  try {
    res.json({
      success: true,
      count: connectionLogs.length,
      logs: connectionLogs.slice(-50).reverse() // Last 50 logs, newest first
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get system statistics
app.get('/api/stats', (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    
    const recentData = sensorData.filter(entry => 
      new Date(entry.received_at) > oneHourAgo
    );
    
    const dailyData = sensorData.filter(entry => 
      new Date(entry.received_at) > oneDayAgo
    );
    
    res.json({
      success: true,
      statistics: {
        total_devices: Object.keys(devices).length,
        total_data_points: sensorData.length,
        data_last_hour: recentData.length,
        data_last_24h: dailyData.length,
        latest_entry: sensorData.length > 0 ? sensorData[sensorData.length - 1] : null,
        server_uptime: process.uptime(),
        memory_usage: process.memoryUsage()
      }
    });
  } catch (error) {
    console.error('Error generating stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete old data (cleanup endpoint)
app.delete('/api/data/cleanup', (req, res) => {
  try {
    const { days = 7 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    const originalLength = sensorData.length;
    const filteredData = sensorData.filter(entry => 
      new Date(entry.received_at) > cutoffDate
    );
    
    sensorData.length = 0; // Clear array
    sensorData.push(...filteredData); // Add back recent data
    
    const deletedCount = originalLength - sensorData.length;
    
    res.json({
      success: true,
      message: `Deleted ${deletedCount} entries older than ${days} days`,
      remaining: sensorData.length
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    available_endpoints: [
      'GET /',
      'GET /health',
      'POST /api/data',
      'GET /api/devices',
      'GET /api/data',
      'GET /api/logs',
      'GET /api/stats'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  logConnection(req, 'ERROR', `Unhandled error: ${err.message}`);
  
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong on our end'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 IoT Sensor Data API Server Started');
  console.log('=====================================');
  console.log(`📡 Server listening on: http://0.0.0.0:${PORT}`);
  console.log(`🔑 API Key configured: ${API_KEY ? '✓' : '✗'}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`📊 Available endpoints:`);
  console.log(`   GET  /              - Service info`);
  console.log(`   GET  /health        - Health check`);
  console.log(`   POST /api/data      - Submit sensor data`);
  console.log(`   GET  /api/devices   - List devices`);
  console.log(`   GET  /api/data      - Get sensor data`);
  console.log(`   GET  /api/logs      - Connection logs`);
  console.log(`   GET  /api/stats     - System statistics`);
  console.log('=====================================\n');
});

module.exports = app;