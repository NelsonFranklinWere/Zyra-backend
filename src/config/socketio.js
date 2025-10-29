const { Server } = require('socket.io');
const jwtTokenUtil = require('../utils/jwtTokenUtil');
const { logger } = require('../utils/logger');

let io;

const setupSocketIO = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware for Socket.IO
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwtTokenUtil.verifyToken(token);
      
      // Ensure it's an access token
      if (decoded.type && decoded.type !== 'access') {
        return next(new Error('Authentication error: Invalid token type'));
      }
      
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      next(new Error(`Authentication error: ${error.message}`));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User ${socket.userId} connected via Socket.IO`);
    
    // Join user to their personal room
    socket.join(`user:${socket.userId}`);
    
    // Join user to role-based rooms
    socket.join(`role:${socket.userRole}`);

    // Handle automation status updates
    socket.on('subscribe_automation', (automationId) => {
      socket.join(`automation:${automationId}`);
      logger.info(`User ${socket.userId} subscribed to automation ${automationId}`);
    });

    // Handle data processing updates
    socket.on('subscribe_data_processing', (processingId) => {
      socket.join(`processing:${processingId}`);
      logger.info(`User ${socket.userId} subscribed to data processing ${processingId}`);
    });

    // Handle AI insight updates
    socket.on('subscribe_ai_insights', (insightId) => {
      socket.join(`insight:${insightId}`);
      logger.info(`User ${socket.userId} subscribed to AI insight ${insightId}`);
    });

    // Handle dashboard updates
    socket.on('subscribe_dashboard', () => {
      socket.join(`dashboard:${socket.userId}`);
      logger.info(`User ${socket.userId} subscribed to dashboard updates`);
    });

    socket.on('disconnect', () => {
      logger.info(`User ${socket.userId} disconnected from Socket.IO`);
    });
  });

  return io;
};

// Utility functions for emitting events
const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

const emitToAutomation = (automationId, event, data) => {
  if (io) {
    io.to(`automation:${automationId}`).emit(event, data);
  }
};

const emitToDataProcessing = (processingId, event, data) => {
  if (io) {
    io.to(`processing:${processingId}`).emit(event, data);
  }
};

const emitToAIInsight = (insightId, event, data) => {
  if (io) {
    io.to(`insight:${insightId}`).emit(event, data);
  }
};

const emitToDashboard = (userId, event, data) => {
  if (io) {
    io.to(`dashboard:${userId}`).emit(event, data);
  }
};

const emitToRole = (role, event, data) => {
  if (io) {
    io.to(`role:${role}`).emit(event, data);
  }
};

const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

module.exports = {
  setupSocketIO,
  emitToUser,
  emitToAutomation,
  emitToDataProcessing,
  emitToAIInsight,
  emitToDashboard,
  emitToRole,
  emitToAll
};

