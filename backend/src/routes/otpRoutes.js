const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otpController');
const rateLimit = require('express-rate-limit');

// Rate limiter for OTP endpoints
const otpLimiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS,
  max: process.env.RATE_LIMIT_MAX_REQUESTS,
  message: { error: 'Too many requests, please try again later.' }
});

// Apply rate limiter to all OTP routes
router.use(otpLimiter);

// OTP routes
router.post('/generate', otpController.generateAndSendOTP);
router.post('/verify', otpController.verifyOTP);
router.post('/resend', otpController.resendOTP);

module.exports = router; 