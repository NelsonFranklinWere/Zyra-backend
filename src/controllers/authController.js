const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const crypto = require('crypto');
// const otpService = require('../services/otpService');
// const googleAuthService = require('../services/googleAuthService');

// Generate JWT token
const generateToken = (userId, role = 'user') => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Register new user
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const [user] = await db('users').insert({
      email,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      verification_token: verificationToken,
      preferences: {
        theme: 'dark',
        notifications: true,
        language: 'en'
      }
    }).returning(['id', 'email', 'first_name', 'last_name', 'role', 'is_active', 'is_verified', 'created_at']);

    // Generate token
    const token = generateToken(user.id, user.role);

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user,
        token
      }
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user
    const user = await db('users').where({ email }).first();
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken(user.id, user.role);

    // Update last login
    await db('users').where({ id: user.id }).update({
      updated_at: new Date()
    });

    logger.info(`User logged in: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          isVerified: user.is_verified,
          preferences: user.preferences
        },
        token
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const user = await db('users')
      .select('id', 'email', 'first_name', 'last_name', 'role', 'is_verified', 'preferences', 'created_at')
      .where({ id: req.user.userId })
      .first();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isVerified: user.is_verified,
        preferences: user.preferences,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, preferences } = req.body;
    const updateData = {};

    if (firstName) updateData.first_name = firstName;
    if (lastName) updateData.last_name = lastName;
    if (preferences) updateData.preferences = preferences;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    updateData.updated_at = new Date();

    await db('users').where({ id: req.user.userId }).update(updateData);

    logger.info(`User profile updated: ${req.user.userId}`);

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters'
      });
    }

    // Get current user
    const user = await db('users').where({ id: req.user.userId }).first();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db('users').where({ id: req.user.userId }).update({
      password_hash: newPasswordHash,
      updated_at: new Date()
    });

    logger.info(`Password changed for user: ${req.user.userId}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    // In a more sophisticated setup, you might want to blacklist the token
    logger.info(`User logged out: ${req.user.userId}`);
    
    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Forgot password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await db('users').where({ email }).first();
    if (!user) {
      // Don't reveal if user exists or not
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await db('users').where({ id: user.id }).update({
      reset_password_token: resetToken,
      reset_password_expires: resetExpires
    });

    // In a real application, you would send an email here
    logger.info(`Password reset requested for: ${email}, token: ${resetToken}`);

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent'
    });

  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters'
      });
    }

    // Find user with valid reset token
    const user = await db('users')
      .where({ reset_password_token: token })
      .where('reset_password_expires', '>', new Date())
      .first();

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear reset token
    await db('users').where({ id: user.id }).update({
      password_hash: passwordHash,
      reset_password_token: null,
      reset_password_expires: null,
      updated_at: new Date()
    });

    logger.info(`Password reset completed for user: ${user.id}`);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Verify email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }

    // Find user with verification token
    const user = await db('users')
      .where({ verification_token: token })
      .first();

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    if (user.is_verified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }

    // Mark email as verified
    await db('users').where({ id: user.id }).update({
      is_verified: true,
      verification_token: null,
      updated_at: new Date()
    });

    logger.info(`Email verified for user: ${user.id}`);

    res.json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    logger.error('Verify email error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    // Generate new access token
    const newToken = generateToken(decoded.userId, decoded.role);

    res.json({
      success: true,
      data: {
        token: newToken
      }
    });

  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
};

// Send OTP for email verification
const sendEmailOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if user exists
    const user = await db('users').where({ email }).first();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Send OTP
    const result = await otpService.sendAndStoreOTP(
      user.id,
      email,
      null,
      'email'
    );

    res.json({
      success: true,
      message: result.message,
      data: {
        expiresIn: result.expiresIn
      }
    });

  } catch (error) {
    logger.error('Send email OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
  }
};

// Send OTP for SMS verification
const sendSMSOTP = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Check if user exists
    const user = await db('users').where({ phone_number: phoneNumber }).first();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Send OTP
    const result = await otpService.sendAndStoreOTP(
      user.id,
      null,
      phoneNumber,
      'sms'
    );

    res.json({
      success: true,
      message: result.message,
      data: {
        expiresIn: result.expiresIn
      }
    });

  } catch (error) {
    logger.error('Send SMS OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
  }
};

// Verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { otpCode, verificationType, email, phoneNumber } = req.body;

    if (!otpCode || !verificationType) {
      return res.status(400).json({
        success: false,
        message: 'OTP code and verification type are required'
      });
    }

    let user;
    if (verificationType === 'email' && email) {
      user = await db('users').where({ email }).first();
    } else if (verificationType === 'sms' && phoneNumber) {
      user = await db('users').where({ phone_number: phoneNumber }).first();
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification type or missing identifier'
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify OTP
    const result = await otpService.verifyOTP(user.id, otpCode, verificationType);

    if (!result.success) {
      // Increment attempts
      await otpService.incrementOTPAttempts(user.id, otpCode, verificationType);
      
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    // Generate token
    const token = generateToken(user.id, user.role);

    res.json({
      success: true,
      message: result.message,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          isVerified: user.is_verified,
          phoneVerified: user.phone_verified,
          preferences: user.preferences
        },
        token
      }
    });

  } catch (error) {
    logger.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP'
    });
  }
};

// Google OAuth routes
const googleAuth = (req, res) => {
  const authUrl = googleAuthService.getGoogleAuthUrl();
  res.redirect(authUrl);
};

const googleCallback = async (req, res) => {
  await googleAuthService.handleGoogleCallback(req, res);
};

// Link Google account
const linkGoogleAccount = async (req, res) => {
  try {
    const { googleId, googleEmail, avatarUrl } = req.body;

    if (!googleId || !googleEmail) {
      return res.status(400).json({
        success: false,
        message: 'Google ID and email are required'
      });
    }

    await googleAuthService.linkGoogleAccount(
      req.user.userId,
      googleId,
      googleEmail,
      avatarUrl
    );

    res.json({
      success: true,
      message: 'Google account linked successfully'
    });

  } catch (error) {
    logger.error('Link Google account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to link Google account'
    });
  }
};

// Unlink Google account
const unlinkGoogleAccount = async (req, res) => {
  try {
    await googleAuthService.unlinkGoogleAccount(req.user.userId);

    res.json({
      success: true,
      message: 'Google account unlinked successfully'
    });

  } catch (error) {
    logger.error('Unlink Google account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unlink Google account'
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  refreshToken,
  sendEmailOTP,
  sendSMSOTP,
  verifyOTP,
  googleAuth,
  googleCallback,
  linkGoogleAccount,
  unlinkGoogleAccount
};
