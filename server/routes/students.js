const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');

const router = express.Router();
router.use(requireAuth);

const WRITE_ROLES = ['Administrator', 'Accountant'];

// GET /api/students?search=&program=&page=1&pageSize=25
router.get('/', (req, res) => {
  const { search = '', program = '', status = '', page = '1', pageSize = '25' } = req.query;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 25));
  const offset = (p - 1) * size;

  const where = [];
  const params = {};
  if (search) {
    where.push(`(first_name LIKE @q OR surname LIKE @q OR middle_name LIKE @q OR student_id LIKE @q OR nrc_no LIKE @q)`);
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

router.get('/programs', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT program FROM students WHERE program IS NOT NULL ORDER BY program').all();
  res.json(rows.map((r) => r.program));
});

router.get('/:id', (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const payments = db.prepare('SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC, id DESC').all(req.params.id);
  const results = db.prepare('SELECT * FROM results WHERE student_id = ? ORDER BY academic_year DESC, id DESC').all(req.params.id);
  res.json({ ...student, payments, results });
});

router.post('/', requireRole(...WRITE_ROLES), (req, res) => {
  const b = req.body || {};
  if (!b.first_name || !b.surname || !b.student_id) {
    return res.status(400).json({ error: 'first_name, surname and student_id are required' });
  }
  try {
    const totalFees = Number(b.total_fees) || 0;
    const feesPaid = Number(b.fees_paid) || 0;
    const info = db.prepare(`
      INSERT INTO students (first_name, middle_name, surname, gender, student_id, nrc_no,
        total_fees, fees_paid, balance_owing, year_of_graduation, program, status)
      VALUES (@first_name, @middle_name, @surname, @gender, @student_id, @nrc_no,
        @total_fees, @fees_paid, @balance_owing, @year_of_graduation, @program, @status)
    `).run({
      first_name: b.first_name,
      middle_name: b.middle_name || null,
      surname: b.surname,
      gender: b.gender || null,
      student_id: b.student_id,
      nrc_no: b.nrc_no || null,
      total_fees: totalFees,
      fees_paid: feesPaid,
      balance_owing: totalFees - feesPaid,
      year_of_graduation: b.year_of_graduation || null,
      program: b.program || null,
      status: b.status || 'Active',
    });
    logAction(req, 'CREATE', 'students', info.lastInsertRowid, b);
    res.status(201).json({ id: info.lastInsertRowid });
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
  const b = { ...existing, ...req.body };
  const totalFees = Number(b.total_fees) || 0;
  const feesPaid = Number(b.fees_paid) || 0;
  db.prepare(`
    UPDATE students SET first_name=@first_name, middle_name=@middle_name, surname=@surname,
      gender=@gender, student_id=@student_id, nrc_no=@nrc_no, total_fees=@total_fees,
      fees_paid=@fees_paid, balance_owing=@balance_owing, year_of_graduation=@year_of_graduation,
      program=@program, status=@status, updated_at=datetime('now')
    WHERE id=@id
  `).run({
    ...b,
    total_fees: totalFees,
    fees_paid: feesPaid,
    balance_owing: totalFees - feesPaid,
    id: req.params.id,
  });
  logAction(req, 'UPDATE', 'students', req.params.id, req.body);
  res.json({ ok: true });
});

router.delete('/:id', requireRole('Administrator'), (req, res) => {
  const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Student not found' });
  db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
  logAction(req, 'DELETE', 'students', req.params.id, { student_id: existing.student_id });
  res.json({ ok: true });
});

module.exports = router;
