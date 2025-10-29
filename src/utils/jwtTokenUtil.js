const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { logger } = require('../utils/logger');

/**
 * JWT Token Utility Service
 * Handles token generation, validation, and refresh token operations
 */
class JwtTokenUtil {
  constructor() {
    this.secret = process.env.JWT_SECRET || this.generateSecret();
    this.expiration = parseInt(process.env.JWT_EXPIRES_IN_MS) || 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    this.refreshExpiration = parseInt(process.env.JWT_REFRESH_EXPIRES_IN_MS) || 30 * 24 * 60 * 60 * 1000; // 30 days
    
    // Warn if using default secret in production
    if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
      logger.warn('⚠️  Using default JWT secret in production! Set JWT_SECRET environment variable.');
    }
  }

  /**
   * Generate a secure random secret if one is not provided
   */
  generateSecret() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate JWT access token
   * @param {string} userId - User ID
   * @param {string} role - User role (default: 'user')
   * @param {Object} additionalClaims - Additional claims to include in token
   * @returns {string} JWT token
   */
  generateToken(userId, role = 'user', additionalClaims = {}) {
    const claims = {
      userId,
      role,
      type: 'access',
      ...additionalClaims
    };

    return jwt.sign(
      claims,
      this.secret,
      {
        expiresIn: this.expiration / 1000, // Convert to seconds
        issuer: 'zyra-api',
        audience: 'zyra-client'
      }
    );
  }

  /**
   * Generate refresh token
   * @param {string} userId - User ID
   * @returns {string} Refresh token
   */
  generateRefreshToken(userId) {
    const claims = {
      userId,
      type: 'refresh'
    };

    return jwt.sign(
      claims,
      this.secret,
      {
        expiresIn: this.refreshExpiration / 1000, // Convert to seconds
        issuer: 'zyra-api',
        audience: 'zyra-client'
      }
    );
  }

  /**
   * Generate both access and refresh tokens
   * @param {string} userId - User ID
   * @param {string} role - User role
   * @param {Object} additionalClaims - Additional claims
   * @returns {Object} Object containing accessToken and refreshToken
   */
  generateTokenPair(userId, role = 'user', additionalClaims = {}) {
    return {
      accessToken: this.generateToken(userId, role, additionalClaims),
      refreshToken: this.generateRefreshToken(userId),
      expiresIn: this.expiration / 1000, // Return in seconds
      tokenType: 'Bearer'
    };
  }

  /**
   * Verify and decode JWT token
   * @param {string} token - JWT token to verify
   * @returns {Object} Decoded token payload
   * @throws {Error} If token is invalid or expired
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: 'zyra-api',
        audience: 'zyra-client'
      });
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token not active yet');
      }
      throw error;
    }
  }

  /**
   * Get username/userId from token (for compatibility)
   * @param {string} token - JWT token
   * @returns {string} User ID
   */
  getUserIdFromToken(token) {
    const decoded = this.verifyToken(token);
    return decoded.userId;
  }

  /**
   * Validate token without throwing errors
   * @param {string} token - JWT token to validate
   * @returns {boolean} True if token is valid, false otherwise
   */
  validateToken(token) {
    try {
      this.verifyToken(token);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Decode token without verification (for debugging)
   * @param {string} token - JWT token
   * @returns {Object} Decoded token payload (not verified)
   */
  decodeToken(token) {
    return jwt.decode(token);
  }

  /**
   * Get token expiration time
   * @param {string} token - JWT token
   * @returns {Date|null} Expiration date or null if invalid
   */
  getTokenExpiration(token) {
    try {
      const decoded = this.decodeToken(token);
      return decoded.exp ? new Date(decoded.exp * 1000) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired
   * @param {string} token - JWT token
   * @returns {boolean} True if expired, false otherwise
   */
  isTokenExpired(token) {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return true;
    return expiration < new Date();
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @param {Function} getUserCallback - Callback to get user details (async)
   * @returns {Object} New token pair
   */
  async refreshAccessToken(refreshToken, getUserCallback) {
    try {
      const decoded = this.verifyToken(refreshToken);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Get user details to refresh role
      const user = await getUserCallback(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new token pair
      return this.generateTokenPair(user.id, user.role);
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }
}

// Export singleton instance
const jwtTokenUtil = new JwtTokenUtil();

module.exports = jwtTokenUtil;
module.exports.JwtTokenUtil = JwtTokenUtil;

