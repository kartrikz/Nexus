const SENSITIVE_KEYS = ['password', 'password_hash', 'token', 'jwt', 'secret', 'api_key', 'authorization'];

function redact(data) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(redact);

  const cleaned = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s))) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = redact(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

const logger = {
  info: (msg, meta = {}) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, Object.keys(meta).length ? redact(meta) : '');
  },
  warn: (msg, meta = {}) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, Object.keys(meta).length ? redact(meta) : '');
  },
  error: (msg, meta = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, Object.keys(meta).length ? redact(meta) : '');
  },
  debug: (msg, meta = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${msg}`, Object.keys(meta).length ? redact(meta) : '');
    }
  }
};

module.exports = logger;
