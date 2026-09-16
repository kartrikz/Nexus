function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return email && typeof email === 'string' && emailRegex.test(email.trim());
}

function validatePassword(password) {
  return password && typeof password === 'string' && password.length >= 6;
}

function validateUsername(username) {
  return username && typeof username === 'string' && username.trim().length >= 2 && username.trim().length <= 50;
}

function validateRegister(req, res, next) {
  const { email, username, password } = req.body;

  if (!email || !validateEmail(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  if (!username || !validateUsername(username)) {
    return res.status(400).json({ error: 'Username must be between 2 and 50 characters.' });
  }

  if (!password || !validatePassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  req.body.email = email.trim().toLowerCase();
  req.body.username = username.trim();
  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body;

  if (!email || !validateEmail(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required.' });
  }

  req.body.email = email.trim().toLowerCase();
  next();
}

module.exports = {
  validateEmail,
  validatePassword,
  validateUsername,
  validateRegister,
  validateLogin
};
