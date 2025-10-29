const jwtTokenUtil = require('../utils/jwtTokenUtil');
const { db } = require('../config/database');
const logger = require('../utils/logger');

/**
 * JWT Authentication Middleware
 * Validates JWT tokens and attaches user info to request
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
        code: 'MISSING_TOKEN'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token using JWT utility
    let decoded;
    try {
      decoded = jwtTokenUtil.verifyToken(token);
      
      // Ensure token is an access token
      if (decoded.type && decoded.type !== 'access') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token type',
          code: 'INVALID_TOKEN_TYPE'
        });
      }
    } catch (error) {
      if (error.message === 'Token expired') {
        return res.status(401).json({
          success: false,
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Check if user still exists and is active
    const user = await db('users')
      .select('id', 'email', 'role', 'is_active', 'is_verified')
      .where({ id: decoded.userId })
      .first();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Add user info to request
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.is_verified
    };

    // Add token info for logging/debugging
    req.token = {
      type: decoded.type || 'access',
      issuedAt: decoded.iat ? new Date(decoded.iat * 1000) : null,
      expiresAt: decoded.exp ? new Date(decoded.exp * 1000) : null
    };

    next();

  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user info if token is present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwtTokenUtil.verifyToken(token);
        
        if (decoded.type === 'access') {
          const user = await db('users')
            .select('id', 'email', 'role', 'is_active')
            .where({ id: decoded.userId })
            .first();

          if (user && user.is_active) {
            req.user = {
              userId: user.id,
              email: user.email,
              role: user.role
            };
          }
        }
      } catch (error) {
        // Silently fail for optional auth
        logger.debug('Optional auth failed:', error.message);
      }
    }

    next();
  } catch (error) {
    // Continue even if optional auth fails
    next();
  }
};

// Role-based authorization middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: allowedRoles,
        current: userRole
      });
    }

    next();
  };
};

// Admin only middleware
const requireAdmin = requireRole(['admin', 'super_admin']);

// Super admin only middleware
const requireSuperAdmin = requireRole(['super_admin']);

module.exports = {
  authMiddleware,
  optionalAuth,
  requireRole,
  requireAdmin,
  requireSuperAdmin
};

