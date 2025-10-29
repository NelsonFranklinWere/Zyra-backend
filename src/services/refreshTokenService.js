const { db } = require('../config/database');
const { logger } = require('../utils/logger');
const jwtTokenUtil = require('./jwtTokenUtil');
const crypto = require('crypto');

/**
 * Refresh Token Service
 * Manages refresh tokens in database with revocation support
 */
class RefreshTokenService {
  /**
   * Generate a secure random token string
   */
  generateTokenString() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create and store refresh token in database
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Refresh token object
   */
  async createRefreshToken(userId) {
    try {
      const tokenString = this.generateTokenString();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const [refreshToken] = await db('refresh_tokens').insert({
        user_id: userId,
        token: tokenString,
        expires_at: expiresAt,
        revoked: false
      }).returning(['id', 'token', 'expires_at', 'created_at']);

      logger.info(`Refresh token created for user: ${userId}`);
      return refreshToken;
    } catch (error) {
      logger.error('Failed to create refresh token:', error);
      throw error;
    }
  }

  /**
   * Find refresh token by token string
   * @param {string} token - Refresh token string
   * @returns {Promise<Object|null>} Refresh token object or null
   */
  async findByToken(token) {
    try {
      const refreshToken = await db('refresh_tokens')
        .where({ token })
        .where('revoked', false)
        .where('expires_at', '>', new Date())
        .first();

      return refreshToken || null;
    } catch (error) {
      logger.error('Failed to find refresh token:', error);
      return null;
    }
  }

  /**
   * Revoke refresh token
   * @param {string} token - Refresh token string
   * @returns {Promise<boolean>} True if revoked successfully
   */
  async revokeToken(token) {
    try {
      const updated = await db('refresh_tokens')
        .where({ token })
        .update({
          revoked: true,
          revoked_at: new Date()
        });

      if (updated > 0) {
        logger.info(`Refresh token revoked: ${token.substring(0, 8)}...`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to revoke refresh token:', error);
      throw error;
    }
  }

  /**
   * Revoke all refresh tokens for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of tokens revoked
   */
  async revokeAllUserTokens(userId) {
    try {
      const updated = await db('refresh_tokens')
        .where({ user_id: userId, revoked: false })
        .update({
          revoked: true,
          revoked_at: new Date()
        });

      logger.info(`Revoked ${updated} refresh tokens for user: ${userId}`);
      return updated;
    } catch (error) {
      logger.error('Failed to revoke user tokens:', error);
      throw error;
    }
  }

  /**
   * Clean expired tokens from database
   * @returns {Promise<number>} Number of tokens deleted
   */
  async cleanExpiredTokens() {
    try {
      const deleted = await db('refresh_tokens')
        .where('expires_at', '<', new Date())
        .orWhere('revoked', true)
        .del();

      if (deleted > 0) {
        logger.info(`Cleaned ${deleted} expired/revoked refresh tokens`);
      }
      return deleted;
    } catch (error) {
      logger.error('Failed to clean expired tokens:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshTokenString - Refresh token string
   * @returns {Promise<Object>} New token pair
   */
  async refreshAccessToken(refreshTokenString) {
    try {
      // Find token in database
      const refreshToken = await this.findByToken(refreshTokenString);
      
      if (!refreshToken) {
        throw new Error('Invalid or expired refresh token');
      }

      // Get user details
      const user = await db('users')
        .select('id', 'role', 'is_active')
        .where({ id: refreshToken.user_id })
        .first();

      if (!user || !user.is_active) {
        throw new Error('User not found or inactive');
      }

      // Revoke old token (one-time use)
      await this.revokeToken(refreshTokenString);

      // Generate new token pair
      const tokenPair = jwtTokenUtil.generateTokenPair(user.id, user.role);

      // Create new refresh token
      const newRefreshToken = await this.createRefreshToken(user.id);

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: newRefreshToken.token,
        expiresIn: tokenPair.expiresIn,
        tokenType: tokenPair.tokenType
      };
    } catch (error) {
      logger.error('Failed to refresh access token:', error);
      throw error;
    }
  }
}

module.exports = new RefreshTokenService();

