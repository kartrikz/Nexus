const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/connection');
const { hashPassword, comparePassword, generateToken } = require('../utils/crypto');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { validateRegister, validateLogin } = require('../middleware/validation');
const logger = require('../utils/logger');

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

// Register
router.post('/register', authLimiter, validateRegister, async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    const db = getDb();

    // Check if email already registered
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const userId = uuidv4();
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, email, username, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, email, username, passwordHash, now, now);

    // Create default starter conversation
    const defaultConvId = uuidv4();
    db.prepare(`
      INSERT INTO conversations (id, user_id, title, model, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(defaultConvId, userId, 'Welcome to NexusMind', 'gpt-4o-mini', now, now);

    db.prepare(`
      INSERT INTO messages (id, conversation_id, user_id, role, content, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      defaultConvId,
      userId,
      'assistant',
      `Hello **${username}**! I'm **NexusMind**, your personal AI assistant.\n\nI have persistent memory, autonomous tools (calculator, real-time clock, weather, web search), voice recognition with dynamic audio visualizers, and file analysis.\n\nHow can I help you today?`,
      'completed',
      now
    );

    const token = generateToken({ userId, email, username });
    res.cookie('token', token, COOKIE_OPTIONS);

    logger.info(`New user registered: ${email} (${userId})`);

    res.status(201).json({
      user: { id: userId, email, username, avatar_url: null, created_at: now },
      token
    });
  } catch (err) {
    next(err);
  }
});

// Login
router.post('/login', authLimiter, validateLogin, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const db = getDb();

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await comparePassword(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken({ userId: user.id, email: user.email, username: user.username });
    res.cookie('token', token, COOKIE_OPTIONS);

    logger.info(`User logged in: ${email}`);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url,
        created_at: user.created_at
      },
      token
    });
  } catch (err) {
    next(err);
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS);
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Current user verification
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Profile update
router.patch('/profile', requireAuth, (req, res, next) => {
  try {
    const { username, avatar_url } = req.body;
    const db = getDb();
    const now = new Date().toISOString();

    if (username && (typeof username !== 'string' || username.trim().length < 2)) {
      return res.status(400).json({ error: 'Username must be at least 2 characters.' });
    }

    const newUsername = username ? username.trim() : req.user.username;
    const newAvatar = avatar_url !== undefined ? avatar_url : req.user.avatar_url;

    db.prepare(`
      UPDATE users SET username = ?, avatar_url = ?, updated_at = ? WHERE id = ?
    `).run(newUsername, newAvatar, now, req.user.id);

    const updatedUser = db.prepare('SELECT id, email, username, avatar_url, created_at, updated_at FROM users WHERE id = ?').get(req.user.id);

    res.json({ user: updatedUser });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
