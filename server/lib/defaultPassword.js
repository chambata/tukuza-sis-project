const bcrypt = require('bcryptjs');
const db = require('../db');

// The seeded administrator password is published in this project's public
// repository and README, so while it is unchanged, anyone on the internet
// effectively holds the Super Administrator credential. Remote (non-local)
// access is refused until it's changed — see the gate in server/index.js.
const DEFAULT_ADMIN_PASSWORD = 'Admin@2026';

let cached = null; // { value: boolean, at: ms }
const TTL_MS = 60 * 1000;

function isDefaultAdminPasswordInUse() {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const admin = db.prepare("SELECT password_hash FROM users WHERE username = 'admin'").get();
  const value = !!admin && bcrypt.compareSync(DEFAULT_ADMIN_PASSWORD, admin.password_hash);
  cached = { value, at: Date.now() };
  return value;
}

/** Call whenever any password changes so the gate reacts immediately instead of waiting out the TTL. */
function invalidateDefaultPasswordCache() {
  cached = null;
}

module.exports = { isDefaultAdminPasswordInUse, invalidateDefaultPasswordCache, DEFAULT_ADMIN_PASSWORD };
