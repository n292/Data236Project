require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const { connectProducer, disconnectProducer } = require('./config/kafka');
const connectionRoutes = require('./routes/connections');

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/connections', connectionRoutes);

// Health check
app.get('/api/connections/health', (req, res) => {
  res.json({ status: 'ok', service: 'connection-service', timestamp: new Date().toISOString() });
});

// Start server
const start = async () => {
  await connectDB();
  await connectProducer();

  app.listen(PORT, () => {
    console.log(`Connection Service running on port ${PORT}`);
  });
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down connection service...');
  await disconnectProducer();
  process.exit(0);
});

start();
