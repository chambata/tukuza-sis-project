const db = require('./db');

const stmt = db.prepare(`
  INSERT INTO audit_log (user_id, username, action, entity, entity_id, details)
  VALUES (@user_id, @username, @action, @entity, @entity_id, @details)
`);

function logAction(req, action, entity, entityId, details) {
  try {
    stmt.run({
      user_id: req.user ? req.user.id : null,
      username: req.user ? req.user.username : 'system',
      action,
      entity: entity || null,
      entity_id: entityId || null,
      details: details ? JSON.stringify(details) : null,
    });
  } catch (err) {
    console.error('[audit] failed to write audit log', err.message);
  }
}

module.exports = { logAction };
