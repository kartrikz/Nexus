const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Get all user settings
router.get('/', requireAuth, (req, res, next) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT setting_key, setting_value FROM user_settings WHERE user_id = ?').all(req.user.id);
    
    const settings = {};
    for (const row of rows) {
      try {
        settings[row.setting_key] = JSON.parse(row.setting_value);
      } catch {
        settings[row.setting_key] = row.setting_value;
      }
    }

    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

// Update or set specific setting key
router.post('/', requireAuth, (req, res, next) => {
  try {
    const { key, value } = req.body;
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'Setting key is required.' });
    }

    const db = getDb();
    const id = uuidv4();
    const stringifiedValue = typeof value === 'string' ? value : JSON.stringify(value);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO user_settings (id, user_id, setting_key, setting_value, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, setting_key) DO UPDATE SET
        setting_value = excluded.setting_value,
        updated_at = excluded.updated_at
    `).run(id, req.user.id, key, stringifiedValue, now);

    res.json({ success: true, key, value });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
