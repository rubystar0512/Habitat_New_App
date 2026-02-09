require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { testConnection } = require('./config/database');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const commitStatusCron = require('./services/commitStatusCron');
const reservationsSyncCron = require('./services/reservationsSyncCron');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
// Increase body parser limit to 50MB for large patch files
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api', routes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Join room for user-specific updates
  socket.on('join-user-room', (userId) => {
    socket.join(`user-${userId}`);
  });

  // Leave user room
  socket.on('leave-user-room', (userId) => {
    socket.leave(`user-${userId}`);
  });
});

// Make io available to routes via app
app.set('io', io);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Start listening
    server.listen(PORT, async () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Socket.IO server ready`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Start commit status cron job
      try {
        await commitStatusCron.start();
        console.log(`⏰ Commit status cron job started`);
      } catch (error) {
        console.error('❌ Failed to start commit status cron:', error);
      }

      // Start reservations sync cron (only if RESERVATIONS_SYNC_ENABLED=true)
      try {
        await reservationsSyncCron.start();
        if (reservationsSyncCron.isEnabled()) {
          console.log(`⏰ Reservations sync cron job started`);
        }
      } catch (error) {
        console.error('❌ Failed to start reservations sync cron:', error);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  commitStatusCron.stop();
  reservationsSyncCron.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  commitStatusCron.stop();
  reservationsSyncCron.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };
