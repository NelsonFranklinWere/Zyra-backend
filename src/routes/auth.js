const express = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const passport = require('passport');
const { otpLimiter, otpVerificationLimiter, authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().isLength({ min: 1 }).withMessage('First name is required'),
  body('lastName').trim().isLength({ min: 1 }).withMessage('Last name is required')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
];

// Public routes with rate limiting
router.post('/register', authLimiter, registerValidation, authController.register);
router.post('/login', authLimiter, loginValidation, authController.login);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.post('/verify-email', authController.verifyEmail);
router.post('/refresh-token', authLimiter, authController.refreshToken);

// OTP routes with strict rate limiting
router.post('/send-email-otp', otpLimiter, authController.sendEmailOTP);
router.post('/send-sms-otp', otpLimiter, authController.sendSMSOTP);
router.post('/verify-otp', otpVerificationLimiter, authController.verifyOTP);

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/auth/callback?error=google_auth_failed' }), authController.googleCallback);

// Protected routes
router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.getProfile);
router.put('/me', authMiddleware, authController.updateProfile);
router.post('/change-password', authMiddleware, authController.changePassword);
router.post('/link-google', authMiddleware, authController.linkGoogleAccount);
router.post('/unlink-google', authMiddleware, authController.unlinkGoogleAccount);

module.exports = router;
