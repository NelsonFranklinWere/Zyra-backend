const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { db } = require('../config/database');
const { logger } = require('../utils/logger');
const jwtTokenUtil = require('../utils/jwtTokenUtil');

class GoogleAuthService {
  constructor() {
    this.setupPassport();
  }

  setupPassport() {
    // Configure Google OAuth strategy
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback'
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const { id, emails, name, photos } = profile;
        const email = emails[0].value;
        const firstName = name.givenName;
        const lastName = name.familyName;
        const avatarUrl = photos[0]?.value;

        // Check if user exists with same email
        let user = await db('users').where({ email }).first();
        
        if (!user) {
          // Create new user (without Google OAuth specific fields for now)
          [user] = await db('users').insert({
            email,
            first_name: firstName,
            last_name: lastName,
            password_hash: 'google_oauth_user', // Placeholder for Google OAuth users
            is_verified: true, // Google users are pre-verified
            is_active: true,
            role: 'user',
            preferences: {
              theme: 'dark',
              notifications: true,
              language: 'en'
            }
          }).returning(['id', 'email', 'first_name', 'last_name', 'role', 'is_active', 'is_verified', 'created_at']);
        }

        logger.info('Google OAuth strategy completed successfully:', { userId: user.id, email: user.email });
        return done(null, user);
      } catch (error) {
        logger.error('Google OAuth error:', error);
        return done(error, null);
      }
    }));

    // Serialize user for session
    passport.serializeUser((user, done) => {
      done(null, user.id);
    });

    // Deserialize user from session
    passport.deserializeUser(async (id, done) => {
      try {
        const user = await db('users').where({ id }).first();
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    });
  }

  // Generate JWT token for Google user
  generateToken(userId, role = 'user') {
    return jwtTokenUtil.generateToken(userId, role);
  }

  // Handle Google OAuth callback
  async handleGoogleCallback(req, res) {
    try {
      logger.info('Google callback received:', { user: req.user, query: req.query });
      
      const user = req.user;
      
      if (!user) {
        logger.error('No user found in Google callback');
        return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=google_auth_failed`);
      }

      logger.info('User found in Google callback:', { userId: user.id, email: user.email });

      // Generate JWT token
      const token = this.generateToken(user.id, user.role);

      // Redirect to frontend callback page with token
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isVerified: user.is_verified,
        avatarUrl: user.avatar_url
      }))}`;

      logger.info('Redirecting to frontend:', { redirectUrl });
      res.redirect(redirectUrl);
    } catch (error) {
      logger.error('Google callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=server_error`);
    }
  }

  // Get Google OAuth URL
  getGoogleAuthUrl() {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback')}&` +
      `scope=profile email&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent`;

    return authUrl;
  }

  // Link Google account to existing user
  async linkGoogleAccount(userId, googleId, googleEmail, avatarUrl) {
    try {
      await db('users')
        .where({ id: userId })
        .update({
          google_id: googleId,
          google_email: googleEmail,
          avatar_url: avatarUrl,
          updated_at: new Date()
        });

      logger.info(`Google account linked to user: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to link Google account:', error);
      throw error;
    }
  }

  // Unlink Google account
  async unlinkGoogleAccount(userId) {
    try {
      await db('users')
        .where({ id: userId })
        .update({
          google_id: null,
          google_email: null,
          avatar_url: null,
          updated_at: new Date()
        });

      logger.info(`Google account unlinked from user: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to unlink Google account:', error);
      throw error;
    }
  }
}

// Only instantiate if Google OAuth is properly configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  module.exports = new GoogleAuthService();
} else {
  // Export a mock service for development
  module.exports = {
    setupPassport: () => {},
    authenticate: () => {},
    handleCallback: () => {},
    linkAccount: () => {},
    unlinkAccount: () => {}
  };
}
