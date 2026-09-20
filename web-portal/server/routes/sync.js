const express = require('express');
const db = require('../db');

const router = express.Router();

function getSyncKey() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'sync_api_key'").get();
  return row ? row.value : null;
}

function requireSyncKey(req, res, next) {
  const provided = req.headers['x-sync-key'];
  const expected = getSyncKey();
  if (!expected || !provided || provided !== expected) {
    return res.status(401).json({ error: 'Invalid or missing sync key' });
  }
  next();
}

// POST /api/sync — full-refresh sync from the desktop app. Each table is
// wiped and reloaded inside one transaction, so a sync either fully lands or
// fully doesn't (no half-updated state visible to the public/students).
// This intentionally only accepts data — there is no route anywhere in this
// service that lets a request modify data and have it flow back to the
// desktop app.
router.post('/', requireSyncKey, (req, res) => {
  const { students, payments, results, programmes, announcements, settings } = req.body || {};
  if (!Array.isArray(students)) {
    return res.status(400).json({ error: 'students array is required' });
  }

  const txn = db.transaction(() => {
    db.exec('DELETE FROM students; DELETE FROM payments; DELETE FROM results; DELETE FROM programmes; DELETE FROM announcements;');

    const insStudent = db.prepare(`
      INSERT INTO students (id, student_id, password_hash, first_name, middle_name, surname, gender,
        program, year_of_graduation, status, total_fees, fees_paid, balance_owing)
      VALUES (@id, @student_id, @password_hash, @first_name, @middle_name, @surname, @gender,
        @program, @year_of_graduation, @status, @total_fees, @fees_paid, @balance_owing)
    `);
    students.forEach((s) => insStudent.run(s));

    const insPayment = db.prepare(`
      INSERT INTO payments (id, student_id, receipt_no, amount, payment_date, method)
      VALUES (@id, @student_id, @receipt_no, @amount, @payment_date, @method)
    `);
    (payments || []).forEach((p) => insPayment.run(p));

    const insResult = db.prepare(`
      INSERT INTO results (id, student_id, course_name, academic_year, semester, ca_total, exam_score, final_mark, grade, status)
      VALUES (@id, @student_id, @course_name, @academic_year, @semester, @ca_total, @exam_score, @final_mark, @grade, @status)
    `);
    (results || []).forEach((r) => insResult.run(r));

    const insProgramme = db.prepare(`
      INSERT INTO programmes (id, name, code, description, duration_years)
      VALUES (@id, @name, @code, @description, @duration_years)
    `);
    (programmes || []).forEach((p) => insProgramme.run(p));

    const insAnnouncement = db.prepare(`
      INSERT INTO announcements (id, title, message, target, target_programme, created_by, created_at)
      VALUES (@id, @title, @message, @target, @target_programme, @created_by, @created_at)
    `);
    (announcements || []).forEach((a) => insAnnouncement.run(a));

    if (settings) {
      const upsertSetting = db.prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      );
      Object.entries(settings).forEach(([key, value]) => {
        if (key === 'sync_api_key') return; // never overwrite the portal's own key from a sync payload
        upsertSetting.run(key, value ?? '');
      });
    }
  });

  txn();
  console.log(`[sync] Received: ${students.length} students, ${(payments || []).length} payments, ${(results || []).length} results, ${(programmes || []).length} programmes, ${(announcements || []).length} announcements`);
  res.json({ ok: true, synced_at: new Date().toISOString() });
});

module.exports = router;
