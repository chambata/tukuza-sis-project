const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');
const { notify } = require('../lib/notifications');
const { SUPER_ADMIN, ADMINISTRATOR, STUDENT, LECTURER, STAFF_ROLES, ANNOUNCEMENT_WRITE_ROLES } = require('../lib/roles');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const all = db.prepare('SELECT * FROM announcements ORDER BY id DESC LIMIT 100').all();
  // Staff roles see everything (so Administrators can review what's gone out).
  // A Student only sees what was actually targeted at them.
  if (STAFF_ROLES.includes(req.user.role)) return res.json(all);

  const studentProgram = req.user.linked_student_id
    ? (db.prepare('SELECT program FROM students WHERE id = ?').get(req.user.linked_student_id) || {}).program
    : null;

  const visible = all.filter((a) => {
    if (a.target === 'All Users') return true;
    if (req.user.role === STUDENT) {
      if (a.target === 'All Students') return true;
      if (a.target === 'Specific Programme') return a.target_programme === studentProgram;
      return false;
    }
    if (req.user.role === LECTURER && a.target === 'Lecturers') return true;
    return false;
  });
  res.json(visible);
});

router.post('/', requireRole(...ANNOUNCEMENT_WRITE_ROLES), (req, res) => {
  const { title, message, target, target_programme } = req.body || {};
  if (!title || !message) return res.status(400).json({ error: 'title and message are required' });
  const validTargets = ['All Students', 'Specific Programme', 'Lecturers', 'Staff', 'All Users'];
  if (target && !validTargets.includes(target)) return res.status(400).json({ error: 'Invalid target' });

  const info = db.prepare(`
    INSERT INTO announcements (title, message, target, target_programme, created_by, created_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title, message, target || 'All Users', target_programme || null, req.user.full_name || req.user.username, req.user.id);

  // Fan out a notification to whoever this announcement targets.
  const notifyMsg = `New announcement: ${title}`;
  let recipients = [];
  if (target === 'All Students') {
    recipients = db.prepare("SELECT id FROM users WHERE role = ? AND is_active = 1").all(STUDENT);
  } else if (target === 'Specific Programme' && target_programme) {
    recipients = db.prepare(`
      SELECT u.id FROM users u JOIN students s ON s.id = u.linked_student_id
      WHERE u.role = ? AND u.is_active = 1 AND s.program = ?
    `).all(STUDENT, target_programme);
  } else if (target === 'Lecturers') {
    recipients = db.prepare('SELECT id FROM users WHERE role = ? AND is_active = 1').all(LECTURER);
  } else if (target === 'Staff') {
    const placeholders = STAFF_ROLES.map(() => '?').join(',');
    recipients = db.prepare(`SELECT id FROM users WHERE role IN (${placeholders}) AND is_active = 1`).all(...STAFF_ROLES);
  } else {
    recipients = db.prepare('SELECT id FROM users WHERE is_active = 1').all();
  }
  recipients.forEach((u) => notify(u.id, 'ANNOUNCEMENT', notifyMsg, 'announcements', info.lastInsertRowid));

  logAction(req, 'CREATE', 'announcements', info.lastInsertRowid, { title, target });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete('/:id', requireRole(...ANNOUNCEMENT_WRITE_ROLES), (req, res) => {
  const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Announcement not found' });
  db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  logAction(req, 'DELETE', 'announcements', req.params.id, { title: existing.title });
  res.json({ ok: true });
});

module.exports = router;
