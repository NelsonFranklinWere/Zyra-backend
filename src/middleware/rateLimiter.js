const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('redis');

// Initialize Redis client for rate limiting (with fallback to memory store)
let redisClient = null;
let redisConnected = false;

if (process.env.REDIS_URL) {
  try {
    redisClient = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('error', (err) => {
      console.error('Redis rate limiter error:', err);
      redisConnected = false;
    });

    redisClient.on('connect', () => {
      redisConnected = true;
      console.log('Redis connected for rate limiting');
    });

    // Connect Redis (non-blocking)
    redisClient.connect().catch(() => {
      console.warn('Redis connection failed, falling back to memory store');
      redisConnected = false;
    });
  } catch (error) {
    console.warn('Redis initialization failed, using memory store:', error.message);
  }
}

// Helper to create store
const createStore = () => {
  if (redisClient && redisConnected) {
    try {
      return new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
      });
    } catch (error) {
      console.warn('RedisStore creation failed, using memory store:', error.message);
    }
  }
  return undefined; // Use memory store
};

// General rate limiter
const generalLimiter = rateLimit({
  store: createStore(),
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// OTP-specific rate limiter (more restrictive)
const otpLimiter = rateLimit({
  store: createStore(),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.OTP_RATE_LIMIT_MAX_REQUESTS) || 5, // Very restrictive - 5 attempts per 15 min
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again later.',
    code: 'OTP_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development/test mode
    return process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true';
  }
});

// OTP verification rate limiter (stricter)
const otpVerificationLimiter = rateLimit({
  store: createStore(),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.OTP_VERIFICATION_RATE_LIMIT) || 10, // 10 verification attempts per 15 min
  message: {
    success: false,
    message: 'Too many OTP verification attempts. Please request a new OTP.',
    code: 'OTP_VERIFICATION_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth endpoints rate limiter (login, register)
const authLimiter = rateLimit({
  store: createStore(),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 10, // 10 auth attempts per 15 min
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// AI-specific rate limiter (more restrictive)
const aiLimiter = rateLimit({
  store: createStore(),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS) || 50,
  message: {
    success: false,
    message: 'AI rate limit exceeded, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Email-specific rate limiter
const emailLimiter = rateLimit({
  store: createStore(),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.EMAIL_RATE_LIMIT_MAX_REQUESTS) || 200,
  message: {
    success: false,
    message: 'Email rate limit exceeded, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Per-tenant rate limiter
const createTenantLimiter = (maxRequests = 1000) => {
  return rateLimit({
    store: createStore(),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: maxRequests,
    keyGenerator: (req) => {
      // Use tenant ID for rate limiting
      return req.user?.tenantId || req.ip;
    },
    message: {
      success: false,
      message: 'Tenant rate limit exceeded, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

module.exports = {
  generalLimiter,
  otpLimiter,
  otpVerificationLimiter,
  authLimiter,
  aiLimiter,
  emailLimiter,
  createTenantLimiter
};
