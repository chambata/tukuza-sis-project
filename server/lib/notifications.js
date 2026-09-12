const db = require('../db');

const insertNotification = db.prepare(`
  INSERT INTO notifications (user_id, type, message, related_entity, related_id) VALUES (?, ?, ?, ?, ?)
`);

/** Creates a notification for a single user. Safe to call even if userId is null/undefined (no-op). */
function notify(userId, type, message, relatedEntity, relatedId) {
  if (!userId) return;
  try {
    insertNotification.run(userId, type, message, relatedEntity || null, relatedId || null);
  } catch (err) {
    console.error('[notifications] failed to create notification', err.message);
  }
}

/** Notifies the Student-role login linked to a given student record, if one exists. */
function notifyStudent(studentId, type, message, relatedEntity, relatedId) {
  const user = db.prepare('SELECT id FROM users WHERE linked_student_id = ? AND is_active = 1').get(studentId);
  if (user) notify(user.id, type, message, relatedEntity, relatedId);
}

/** Notifies every active user with one of the given roles. */
function notifyRoles(roles, type, message, relatedEntity, relatedId) {
  const placeholders = roles.map(() => '?').join(',');
  const users = db.prepare(`SELECT id FROM users WHERE role IN (${placeholders}) AND is_active = 1`).all(...roles);
  users.forEach((u) => notify(u.id, type, message, relatedEntity, relatedId));
}

module.exports = { notify, notifyStudent, notifyRoles };
