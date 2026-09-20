const db = require('../db');
const { getAllSettings, getSetting } = require('./settings');

/**
 * Gathers everything the public web portal is allowed to see and pushes it
 * in one request. This is intentionally one-way and narrow:
 *  - Only Published/Locked results (never Draft/Submitted/Approved) — the
 *    same visibility rule the desktop Student Portal already enforces.
 *  - Password hashes are included so the *same* username/password works on
 *    both the desktop app and the web portal — bcrypt hashes are one-way,
 *    so this is safe to transmit and store.
 *  - Only students who actually have a portal login (linked_student_id) are
 *    sent at all, since a student with no login can never sign in anyway.
 *  - Only public-facing announcements (never anything targeted at Staff/
 *    Lecturers, which could reference internal matters).
 */
function gatherSyncPayload() {
  const students = db.prepare(`
    SELECT s.id, s.student_id, u.password_hash, s.first_name, s.middle_name, s.surname, s.gender,
      s.program, s.year_of_graduation, s.status, s.total_fees, s.fees_paid, s.balance_owing
    FROM students s
    JOIN users u ON u.linked_student_id = s.id AND u.is_active = 1
  `).all();

  const studentIds = students.map((s) => s.id);
  const idList = studentIds.length ? studentIds.join(',') : '-1';

  const payments = db.prepare(`
    SELECT id, student_id, receipt_no, amount, payment_date, method
    FROM payments WHERE student_id IN (${idList})
  `).all();

  const results = db.prepare(`
    SELECT id, student_id, course_name, academic_year, semester, ca_total, exam_score, final_mark, grade, status
    FROM results WHERE student_id IN (${idList}) AND status IN ('Published','Locked')
  `).all();

  const programmes = db.prepare('SELECT id, name, code, description, duration_years FROM programmes WHERE is_active = 1').all();

  const announcements = db.prepare(`
    SELECT id, title, message, target, target_programme, created_by, created_at
    FROM announcements WHERE target IN ('All Users','All Students','Specific Programme')
    ORDER BY id DESC LIMIT 50
  `).all();

  const allSettings = getAllSettings();
  const settings = {
    institution_name: allSettings.institution_name,
    institution_address: allSettings.institution_address,
    institution_phone: allSettings.institution_phone,
    institution_email: allSettings.institution_email,
    institution_logo: allSettings.institution_logo,
    currency_code: allSettings.currency_code,
    currency_symbol: allSettings.currency_symbol,
  };

  return { students, payments, results, programmes, announcements, settings };
}

/**
 * Pushes the current sync payload to the configured web portal URL. Uses
 * Node's built-in fetch (Node 18+, which Electron bundles) so no extra HTTP
 * client dependency is needed.
 */
async function syncToWebsite() {
  const syncUrl = getSetting('website_sync_url');
  const syncKey = getSetting('website_sync_key');
  if (!syncUrl || !syncKey) {
    throw new Error('Website sync is not configured yet — set the Sync URL and Sync Key in Settings first.');
  }

  const payload = gatherSyncPayload();
  const endpoint = syncUrl.replace(/\/$/, '') + '/api/sync';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Sync-Key': syncKey },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Website responded with ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return { ok: true, ...data, counts: {
      students: payload.students.length, payments: payload.payments.length,
      results: payload.results.length, programmes: payload.programmes.length,
      announcements: payload.announcements.length,
    } };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { gatherSyncPayload, syncToWebsite };
