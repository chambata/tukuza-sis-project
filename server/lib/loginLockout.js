const db = require('../db');

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/** Returns { locked: boolean, retryAfterSeconds } for a given username. */
function checkLockout(username) {
  const row = db.prepare('SELECT * FROM login_attempts WHERE username = ?').get(username);
  if (!row || !row.locked_until) return { locked: false };
  const lockedUntil = new Date(row.locked_until).getTime();
  if (Date.now() < lockedUntil) {
    return { locked: true, retryAfterSeconds: Math.ceil((lockedUntil - Date.now()) / 1000) };
  }
  return { locked: false };
}

/** Records a failed attempt, locking the account once MAX_ATTEMPTS is reached. */
function recordFailure(username) {
  const existing = db.prepare('SELECT * FROM login_attempts WHERE username = ?').get(username);
  const failedCount = (existing ? existing.failed_count : 0) + 1;
  const lockedUntil = failedCount >= MAX_ATTEMPTS
    ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
    : null;
  db.prepare(`
    INSERT INTO login_attempts (username, failed_count, locked_until, last_attempt_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(username) DO UPDATE SET failed_count = excluded.failed_count,
      locked_until = excluded.locked_until, last_attempt_at = excluded.last_attempt_at
  `).run(username, failedCount, lockedUntil);
  return { locked: !!lockedUntil, attemptsRemaining: Math.max(0, MAX_ATTEMPTS - failedCount) };
}

/** Clears the failure count after a successful login. */
function recordSuccess(username) {
  db.prepare('DELETE FROM login_attempts WHERE username = ?').run(username);
}

module.exports = { checkLockout, recordFailure, recordSuccess, MAX_ATTEMPTS, LOCKOUT_MINUTES };
