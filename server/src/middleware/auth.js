const { verifyToken } = require('../utils/crypto');
const { getDb } = require('../db/connection');

function requireAuth(req, res, next) {
  let token = null;

  // Check Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }

  try {
    const db = getDb();
    const stmt = db.prepare('SELECT id, email, username, avatar_url, created_at FROM users WHERE id = ?');
    const user = stmt.get(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User associated with token no longer exists.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Authentication verification failed.' });
  }
}

function optionalAuth(req, res, next) {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    req.user = null;
    return next();
  }

  const decoded = verifyToken(token);
  if (decoded && decoded.userId) {
    try {
      const db = getDb();
      const user = db.prepare('SELECT id, email, username, avatar_url FROM users WHERE id = ?').get(decoded.userId);
      req.user = user || null;
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }

  next();
}

module.exports = { requireAuth, optionalAuth };
