require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { connectProducer, disconnectProducer } = require('./config/kafka');
const threadRoutes = require('./routes/threads');
const messageRoutes = require('./routes/messages');

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/messaging/threads', threadRoutes);
app.use('/api/messaging/messages', messageRoutes);

// Health check
app.get('/api/messaging/health', (req, res) => {
  res.json({ status: 'ok', service: 'messaging-service', timestamp: new Date().toISOString() });
});

// Start server
const start = async () => {
  await connectDB();
  await connectProducer();

  app.listen(PORT, () => {
    console.log(`Messaging Service running on port ${PORT}`);
  });
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down messaging service...');
  await disconnectProducer();
  process.exit(0);
});

start();
