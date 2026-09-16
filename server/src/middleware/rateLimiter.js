const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // max 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // max 30 auth attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login or registration attempts. Please try again in 15 minutes.' }
});

const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // max 30 AI messages per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Message rate limit exceeded. Please wait a moment.' }
});

module.exports = {
  generalLimiter,
  authLimiter,
  chatLimiter
};
