const express = require('express');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');
const { newDocument, footer } = require('../lib/pdf');
const { computeGPA } = require('../lib/grades');
const { STUDENT_WRITE_ROLES, STAFF_ROLES, SUPER_ADMIN, ADMINISTRATOR, STUDENT } = require('../lib/roles');

const router = express.Router();
router.use(requireAuth);

const WRITE_ROLES = STUDENT_WRITE_ROLES;

// Allows staff roles to access any student's documents, and allows a Student
// role to access only the documents for their own linked student record.
function staffOrSelf(req, res, next) {
  if (STAFF_ROLES.includes(req.user.role)) return next();
  if (req.user.role === STUDENT && String(req.user.linked_student_id) === String(req.params.id)) {
    return next();
  }
  return res.status(403).json({ error: 'You do not have permission to access this record' });
}

// GET /api/students?search=&program=&page=1&pageSize=25
router.get('/', requireRole(...STAFF_ROLES), (req, res) => {
  const { search = '', program = '', status = '', page = '1', pageSize = '25' } = req.query;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 25));
  const offset = (p - 1) * size;

  const where = [];
  const params = {};
  if (search) {
    where.push(`(first_name LIKE @q OR surname LIKE @q OR middle_name LIKE @q OR student_id LIKE @q OR nrc_no LIKE @q OR phone_number LIKE @q OR email LIKE @q)`);
    params.q = `%${search}%`;
  }
  if (program) {
    where.push('program = @program');
    params.program = program;
  }
  if (status) {
    where.push('status = @status');
    params.status = status;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS c FROM students ${whereSql}`).get(params).c;
  const rows = db.prepare(
    `SELECT * FROM students ${whereSql} ORDER BY surname, first_name LIMIT @limit OFFSET @offset`
  ).all({ ...params, limit: size, offset });

  res.json({ data: rows, total, page: p, pageSize: size });
});

router.get('/programs', requireRole(...STAFF_ROLES), (req, res) => {
  const rows = db.prepare('SELECT DISTINCT program FROM students WHERE program IS NOT NULL ORDER BY program').all();
  res.json(rows.map((r) => r.program));
});

// GET /api/students/report.pdf?search=&program=&status=  — must be registered
// before the generic /:id route below, or Express will treat "report.pdf" as an id.
router.get('/report.pdf', requireRole(...STAFF_ROLES), (req, res) => {
  const { search = '', program = '', status = '' } = req.query;
  const where = [];
  const params = {};
  if (search) {
    where.push(`(first_name LIKE @q OR surname LIKE @q OR middle_name LIKE @q OR student_id LIKE @q)`);
    params.q = `%${search}%`;
  }
  if (program) { where.push('program = @program'); params.program = program; }
  if (status) { where.push('status = @status'); params.status = status; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM students ${whereSql} ORDER BY surname, first_name`).all(params);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="students-report.pdf"');

  const doc = newDocument({ title: 'Students Report' });
  doc.pipe(res);

  const filters = [
    search && `Search: "${search}"`,
    program && `Program: ${program}`,
    status && `Status: ${status}`,
  ].filter(Boolean).join('   ·   ');
  doc.fontSize(10).fillColor('#444444').text(filters || 'All students', { align: 'left' });
  doc.fillColor('#000000').moveDown(0.5);
  doc.fontSize(10).font('Helvetica-Bold').text(`Total: ${rows.length} students`);
  doc.moveDown();

  const colX = { id: 50, name: 130, program: 300, fees: 430, balance: 500 };
  function drawHeader() {
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Student ID', colX.id, doc.y, { continued: false });
    doc.text('Name', colX.name, doc.y - doc.currentLineHeight());
    doc.text('Program', colX.program, doc.y - doc.currentLineHeight());
    doc.text('Paid', colX.fees, doc.y - doc.currentLineHeight());
    doc.text('Balance', colX.balance, doc.y - doc.currentLineHeight());
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#cccccc');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9);
  }
  drawHeader();

  rows.forEach((r) => {
    if (doc.y > doc.page.height - 80) {
      doc.addPage();
      doc.y = 60;
      drawHeader();
    }
    const rowY = doc.y;
    doc.text(r.student_id, colX.id, rowY, { width: 75 });
    doc.text([r.first_name, r.surname].filter(Boolean).join(' '), colX.name, rowY, { width: 165 });
    doc.text(r.program || '—', colX.program, rowY, { width: 125 });
    doc.text(`K${Number(r.fees_paid).toLocaleString()}`, colX.fees, rowY, { width: 65 });
    doc.text(`K${Number(r.balance_owing).toLocaleString()}`, colX.balance, rowY, { width: 65 });
    doc.moveDown(0.6);
  });

  footer(doc);
  doc.end();
});

// GET /api/students/me — self-service endpoint for the Student role. Must be
// registered before the generic /:id route below.
router.get('/me', requireRole(STUDENT), (req, res) => {
  if (!req.user.linked_student_id) {
    return res.status(404).json({ error: 'Your account is not linked to a student record. Contact the registrar.' });
  }
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.user.linked_student_id);
  if (!student) return res.status(404).json({ error: 'Linked student record not found' });
  const payments = db.prepare('SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC, id DESC').all(student.id);
  const results = db.prepare('SELECT * FROM results WHERE student_id = ? ORDER BY academic_year DESC, semester, type, id').all(student.id);
  res.json({ ...student, payments, results, gpa: computeGPA(results) });
});

router.post('/:id/create-login', requireRole(SUPER_ADMIN, ADMINISTRATOR), (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const existingLink = db.prepare('SELECT id FROM users WHERE linked_student_id = ?').get(student.id);
  if (existingLink) return res.status(409).json({ error: 'This student already has a login account' });

  const { password } = req.body || {};
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const fullName = [student.first_name, student.surname].filter(Boolean).join(' ');
    const info = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, linked_student_id)
      VALUES (?, ?, ?, 'Student', ?)
    `).run(student.student_id, hash, fullName, student.id);
    logAction(req, 'CREATE', 'users', info.lastInsertRowid, { username: student.student_id, role: 'Student', linked_student_id: student.id });
    res.status(201).json({ id: info.lastInsertRowid, username: student.student_id });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'A login with this Student ID already exists' });
    }
    res.status(500).json({ error: 'Failed to create login' });
  }
});

router.get('/:id', requireRole(...STAFF_ROLES), (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const payments = db.prepare('SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC, id DESC').all(req.params.id);
  const results = db.prepare('SELECT * FROM results WHERE student_id = ? ORDER BY academic_year DESC, semester, type, id').all(req.params.id);
  const loginAccount = db.prepare('SELECT id, username, is_active FROM users WHERE linked_student_id = ?').get(req.params.id);
  res.json({ ...student, payments, results, loginAccount: loginAccount || null });
});

router.get('/:id/id-card.pdf', staffOrSelf, async (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const qrDataUrl = await QRCode.toDataURL(
    JSON.stringify({ id: student.student_id, name: [student.first_name, student.surname].filter(Boolean).join(' '), program: student.program }),
    { margin: 1, width: 200 }
  );
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${student.student_id}-id-card.pdf"`);

  // Credit-card sized pages (85.6mm x 54mm, in points: 1mm ≈ 2.834pt) — front then back.
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: [242.6, 153.0], margin: 0 });
  doc.pipe(res);

  // --- FRONT ---
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');
  doc.rect(0, 0, doc.page.width, 34).fill('#0b5d3b');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
    .text('FOUNTAIN OF PEACE UNIVERSITY COLLEGE', 8, 6, { width: doc.page.width - 16 });
  doc.fontSize(7).font('Helvetica').text('Student Identity Card', 8, 20);

  const PHOTO_X = 8, PHOTO_Y = 42, PHOTO_SIZE = 54;
  if (student.passport_photo) {
    try {
      const base64 = student.passport_photo.split(',')[1] || student.passport_photo;
      const photoBuffer = Buffer.from(base64, 'base64');
      doc.image(photoBuffer, PHOTO_X, PHOTO_Y, { width: PHOTO_SIZE, height: PHOTO_SIZE, fit: [PHOTO_SIZE, PHOTO_SIZE] });
    } catch (err) {
      doc.rect(PHOTO_X, PHOTO_Y, PHOTO_SIZE, PHOTO_SIZE).stroke('#cccccc');
    }
  } else {
    doc.rect(PHOTO_X, PHOTO_Y, PHOTO_SIZE, PHOTO_SIZE).stroke('#cccccc');
    doc.fontSize(6).fillColor('#999999').text('No Photo', PHOTO_X, PHOTO_Y + PHOTO_SIZE / 2 - 3, { width: PHOTO_SIZE, align: 'center' });
  }

  const INFO_X = PHOTO_X + PHOTO_SIZE + 8;
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9)
    .text([student.first_name, student.surname].filter(Boolean).join(' '), INFO_X, 42, { width: 90 });
  doc.font('Helvetica').fontSize(7);
  doc.text(`ID: ${student.student_id}`, INFO_X, 56, { width: 90 });
  doc.text(`${student.program || '—'}`, INFO_X, 68, { width: 90 });
  doc.text(`Class of: ${student.year_of_graduation || '—'}`, INFO_X, 88, { width: 90 });

  doc.image(qrBuffer, doc.page.width - 60, PHOTO_Y, { width: 52, height: 52 });

  doc.fontSize(6).fillColor('#666666')
    .text('Property of Fountain of Peace University College. If found, please return.', 8, doc.page.height - 14, {
      width: doc.page.width - 16,
    });

  // --- BACK ---
  doc.addPage({ size: [242.6, 153.0], margin: 0 });
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');
  doc.rect(0, 0, doc.page.width, 20).fill('#0b5d3b');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7).text('CONTACT & VALIDITY', 8, 6);

  doc.fillColor('#000000').font('Helvetica').fontSize(7);
  doc.text('Fountain of Peace University College', 8, 26);
  doc.text('P.O. Box 560277, Lusaka, Zambia', 8, 37);
  doc.text(`Student contact: ${student.phone_number || '—'}`, 8, 52);
  doc.text(`Status: ${student.status}`, 8, 64);
  doc.text(`Card valid through: ${student.year_of_graduation || '—'}`, 8, 76);

  doc.moveTo(8, 118).lineTo(120, 118).stroke('#999999');
  doc.fontSize(6).text('Authorized Signature', 8, 121);

  doc.fontSize(5.5).fillColor('#666666')
    .text('This card remains the property of Fountain of Peace University College and must be surrendered upon request.', 8, doc.page.height - 18, {
      width: doc.page.width - 16,
    });

  logAction(req, 'PRINT', 'students', student.id, { document: 'id-card' });
  doc.end();
});

router.get('/:id/transcript.pdf', staffOrSelf, (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const results = db.prepare(
    "SELECT * FROM results WHERE student_id = ? AND status = 'Approved' ORDER BY academic_year, semester, type, course_name"
  ).all(req.params.id);
  const gpa = computeGPA(results);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${student.student_id}-transcript.pdf"`);

  const doc = newDocument({ title: 'Academic Transcript' });
  doc.pipe(res);

  const studentName = [student.first_name, student.middle_name, student.surname].filter(Boolean).join(' ');
  doc.fontSize(12).font('Helvetica-Bold').text(studentName);
  doc.font('Helvetica').fontSize(10);
  doc.text(`Student ID: ${student.student_id}`);
  doc.text(`Program: ${student.program || '—'}`);
  doc.text(`Status: ${student.status}`);
  if (gpa !== null) doc.text(`Cumulative GPA: ${gpa.toFixed(2)}`);
  doc.text(`Transcript date: ${new Date().toLocaleDateString()}`);
  doc.moveDown();

  if (results.length === 0) {
    doc.text('No approved results are on record for this student yet.');
  } else {
    let currentYear = null;
    results.forEach((r) => {
      const yearLabel = [r.academic_year, r.semester].filter(Boolean).join(' — ') || 'Unspecified period';
      if (yearLabel !== currentYear) {
        currentYear = yearLabel;
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(10).text(yearLabel, 50, doc.y, { width: doc.page.width - 100 });
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#cccccc');
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(10);
      }
      const rowY = doc.y;
      doc.text(r.course_name, 60, rowY, { width: 260 });
      doc.text(r.type, 325, rowY, { width: 50, align: 'center' });
      doc.text(r.score != null ? String(r.score) : '—', 380, rowY, { width: 55, align: 'center' });
      doc.text(r.grade || '—', 440, rowY, { width: 55, align: 'center' });
      doc.moveDown(0.4);
    });
  }

  footer(doc, 'Unofficial transcript generated by the Tukuza SIS. Contact the registrar for a certified copy. Only approved results are shown.');
  doc.end();
});

router.get('/:id/statement.pdf', staffOrSelf, (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const payments = db.prepare('SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date, id').all(req.params.id);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${student.student_id}-statement.pdf"`);

  const doc = newDocument({ title: 'Fee Statement' });
  doc.pipe(res);

  const studentName = [student.first_name, student.middle_name, student.surname].filter(Boolean).join(' ');
  doc.fontSize(12).font('Helvetica-Bold').text(studentName);
  doc.font('Helvetica').fontSize(10);
  doc.text(`Student ID: ${student.student_id}`);
  doc.text(`Program: ${student.program || '—'}`);
  doc.text(`Statement date: ${new Date().toLocaleDateString()}`);
  doc.moveDown();

  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('Date', 50, doc.y, { continued: false, width: 90 });
  doc.text('Receipt No.', 140, doc.y - doc.currentLineHeight(), { width: 140 });
  doc.text('Method', 280, doc.y - doc.currentLineHeight(), { width: 100 });
  doc.text('Amount', 460, doc.y - doc.currentLineHeight(), { width: 80, align: 'right' });
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#cccccc');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10);

  if (payments.length === 0) {
    doc.text('No payments recorded.');
  }
  payments.forEach((p) => {
    const rowY = doc.y;
    doc.text(p.payment_date, 50, rowY, { width: 90 });
    doc.text(p.receipt_no, 140, rowY, { width: 140 });
    doc.text(p.method, 280, rowY, { width: 100 });
    doc.text(`K${Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 460, rowY, { width: 80, align: 'right' });
    doc.moveDown(0.5);
  });

  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#cccccc');
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text(`Total Fees: K${Number(student.total_fees).toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
  doc.text(`Total Paid: K${Number(student.fees_paid).toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
  doc.text(`Balance Owing: K${Number(student.balance_owing).toLocaleString(undefined, { minimumFractionDigits: 2 })}`);

  footer(doc);
  doc.end();
});

function nextAutoStudentId() {
  const year = new Date().getFullYear();
  const prefix = `TUK/${year}/`;
  const row = db.prepare(
    `SELECT student_id FROM students WHERE student_id LIKE ? ORDER BY student_id DESC LIMIT 1`
  ).get(`${prefix}%`);
  let seq = 1;
  if (row) {
    const parts = row.student_id.split('/');
    seq = (parseInt(parts[2], 10) || 0) + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

function checkDuplicates(b, excludeId) {
  if (b.nrc_no && b.nrc_no.trim()) {
    const dupe = db.prepare('SELECT id FROM students WHERE nrc_no = ? AND id != ?').get(b.nrc_no.trim(), excludeId || -1);
    if (dupe) return 'A student with this NRC number already exists';
  }
  if (b.email && b.email.trim()) {
    const dupe = db.prepare('SELECT id FROM students WHERE email = ? AND id != ?').get(b.email.trim(), excludeId || -1);
    if (dupe) return 'A student with this email address already exists';
  }
  return null;
}

router.post('/', requireRole(...WRITE_ROLES), (req, res) => {
  const b = req.body || {};
  if (!b.first_name || !b.surname) {
    return res.status(400).json({ error: 'first_name and surname are required' });
  }
  const dupeError = checkDuplicates(b);
  if (dupeError) return res.status(409).json({ error: dupeError });
  try {
    const totalFees = Number(b.total_fees) || 0;
    const feesPaid = Number(b.fees_paid) || 0;
    const studentId = (b.student_id && b.student_id.trim()) || nextAutoStudentId();
    const info = db.prepare(`
      INSERT INTO students (first_name, middle_name, surname, gender, date_of_birth, nationality,
        phone_number, email, residential_address, passport_photo, student_id, nrc_no,
        total_fees, fees_paid, balance_owing, year_of_graduation, program, department_id,
        intake_id, academic_year, year_of_study, semester, status)
      VALUES (@first_name, @middle_name, @surname, @gender, @date_of_birth, @nationality,
        @phone_number, @email, @residential_address, @passport_photo, @student_id, @nrc_no,
        @total_fees, @fees_paid, @balance_owing, @year_of_graduation, @program, @department_id,
        @intake_id, @academic_year, @year_of_study, @semester, @status)
    `).run({
      first_name: b.first_name,
      middle_name: b.middle_name || null,
      surname: b.surname,
      gender: b.gender || null,
      date_of_birth: b.date_of_birth || null,
      nationality: b.nationality || null,
      phone_number: b.phone_number || null,
      email: b.email || null,
      residential_address: b.residential_address || null,
      passport_photo: b.passport_photo || null,
      student_id: studentId,
      nrc_no: b.nrc_no || null,
      total_fees: totalFees,
      fees_paid: feesPaid,
      balance_owing: totalFees - feesPaid,
      year_of_graduation: b.year_of_graduation || null,
      program: b.program || null,
      department_id: b.department_id || null,
      intake_id: b.intake_id || null,
      academic_year: b.academic_year || null,
      year_of_study: b.year_of_study || null,
      semester: b.semester || null,
      status: b.status || 'Active',
    });
    logAction(req, 'CREATE', 'students', info.lastInsertRowid, { ...b, passport_photo: b.passport_photo ? '(photo omitted from log)' : null });
    res.status(201).json({ id: info.lastInsertRowid, student_id: studentId });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'A student with this Student ID already exists' });
    }
    res.status(500).json({ error: 'Failed to create student' });
  }
});

router.put('/:id', requireRole(...WRITE_ROLES), (req, res) => {
  const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Student not found' });
  const dupeError = checkDuplicates(req.body || {}, req.params.id);
  if (dupeError) return res.status(409).json({ error: dupeError });
  const b = { ...existing, ...req.body };
  const totalFees = Number(b.total_fees) || 0;
  const feesPaid = Number(b.fees_paid) || 0;
  try {
    db.prepare(`
      UPDATE students SET first_name=@first_name, middle_name=@middle_name, surname=@surname,
        gender=@gender, date_of_birth=@date_of_birth, nationality=@nationality,
        phone_number=@phone_number, email=@email, residential_address=@residential_address,
        passport_photo=@passport_photo, student_id=@student_id, nrc_no=@nrc_no, total_fees=@total_fees,
        fees_paid=@fees_paid, balance_owing=@balance_owing, year_of_graduation=@year_of_graduation,
        program=@program, department_id=@department_id, intake_id=@intake_id,
        academic_year=@academic_year, year_of_study=@year_of_study, semester=@semester,
        status=@status, updated_at=datetime('now')
      WHERE id=@id
    `).run({
      ...b,
      total_fees: totalFees,
      fees_paid: feesPaid,
      balance_owing: totalFees - feesPaid,
      id: req.params.id,
    });
    logAction(req, 'UPDATE', 'students', req.params.id, { ...req.body, passport_photo: req.body.passport_photo ? '(photo omitted from log)' : undefined });
    res.json({ ok: true });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'A student with this Student ID already exists' });
    }
    res.status(500).json({ error: 'Failed to update student' });
  }
});

router.delete('/:id', requireRole(SUPER_ADMIN), (req, res) => {
  const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Student not found' });
  db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
  logAction(req, 'DELETE', 'students', req.params.id, { student_id: existing.student_id });
  res.json({ ok: true });
});

module.exports = router;
