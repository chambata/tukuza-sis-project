const jwt = require('jsonwebtoken');
const { getSetting } = require('../lib/settings');

// Lazily read + cache the per-install JWT secret from the settings table
// (generated once at first launch — see server/db.js). Read lazily rather
// than at module load time so require-order relative to db.js never matters.
let cachedSecret = null;
function getJwtSecret() {
  if (!cachedSecret) {
    cachedSecret = getSetting('jwt_secret') || process.env.JWT_SECRET;
    if (!cachedSecret) {
      throw new Error('No JWT secret is configured — this should never happen after server/db.js has run.');
    }
  }
  return cachedSecret;
}

/** Drops the in-memory cached secret so the next request re-reads it from the database (used after rotation). */
function resetJwtSecretCache() {
  cachedSecret = null;
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, getJwtSecret());
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, getJwtSecret, resetJwtSecretCache };
