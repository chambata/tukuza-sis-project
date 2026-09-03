const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const { search = '', department = '' } = req.query;
  const where = [];
  const params = {};
  if (search) {
    where.push('(s.first_name LIKE @q OR s.last_name LIKE @q OR s.email LIKE @q OR s.nrc_number LIKE @q)');
    params.q = `%${search}%`;
  }
  if (department) {
    where.push('d.name = @department');
    params.department = department;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT s.*, d.name AS department_name
    FROM staff s LEFT JOIN departments d ON d.id = s.department_id
    ${whereSql}
    ORDER BY s.last_name, s.first_name
  `).all(params);
  res.json(rows);
});

router.get('/departments', (req, res) => {
  res.json(db.prepare('SELECT * FROM departments ORDER BY name').all());
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT s.*, d.name AS department_name FROM staff s
    LEFT JOIN departments d ON d.id = s.department_id WHERE s.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Staff member not found' });
  res.json(row);
});

router.post('/', requireRole('Administrator'), (req, res) => {
  const b = req.body || {};
  if (!b.first_name || !b.last_name) {
    return res.status(400).json({ error: 'first_name and last_name are required' });
  }
  let departmentId = b.department_id || null;
  if (!departmentId && b.department_name) {
    const existing = db.prepare('SELECT id FROM departments WHERE name = ?').get(b.department_name);
    departmentId = existing ? existing.id : db.prepare('INSERT INTO departments (name) VALUES (?)').run(b.department_name).lastInsertRowid;
  }
  const info = db.prepare(`
    INSERT INTO staff (title, first_name, last_name, middle_name, gender, dob, age, nrc_number,
      passport_no, nationality, email, phone_number, postal_address, disability, academic_rank,
      highest_level_of_study, field_of_study, mode_of_employment, department_id)
    VALUES (@title, @first_name, @last_name, @middle_name, @gender, @dob, @age, @nrc_number,
      @passport_no, @nationality, @email, @phone_number, @postal_address, @disability, @academic_rank,
      @highest_level_of_study, @field_of_study, @mode_of_employment, @department_id)
  `).run({
    title: b.title || null,
    first_name: b.first_name,
    last_name: b.last_name,
    middle_name: b.middle_name || null,
    gender: b.gender || null,
    dob: b.dob || null,
    age: b.age || null,
    nrc_number: b.nrc_number || null,
    passport_no: b.passport_no || null,
    nationality: b.nationality || null,
    email: b.email || null,
    phone_number: b.phone_number || null,
    postal_address: b.postal_address || null,
    disability: b.disability || null,
    academic_rank: b.academic_rank || null,
    highest_level_of_study: b.highest_level_of_study || null,
    field_of_study: b.field_of_study || null,
    mode_of_employment: b.mode_of_employment || null,
    department_id: departmentId,
  });
  logAction(req, 'CREATE', 'staff', info.lastInsertRowid, b);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', requireRole('Administrator'), (req, res) => {
  const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Staff member not found' });
  const b = { ...existing, ...req.body, id: req.params.id };
  db.prepare(`
    UPDATE staff SET title=@title, first_name=@first_name, last_name=@last_name,
      middle_name=@middle_name, gender=@gender, dob=@dob, age=@age, nrc_number=@nrc_number,
      passport_no=@passport_no, nationality=@nationality, email=@email, phone_number=@phone_number,
      postal_address=@postal_address, disability=@disability, academic_rank=@academic_rank,
      highest_level_of_study=@highest_level_of_study, field_of_study=@field_of_study,
      mode_of_employment=@mode_of_employment, department_id=@department_id, updated_at=datetime('now')
    WHERE id=@id
  `).run(b);
  logAction(req, 'UPDATE', 'staff', req.params.id, req.body);
  res.json({ ok: true });
});

router.delete('/:id', requireRole('Administrator'), (req, res) => {
  const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Staff member not found' });
  db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id);
  logAction(req, 'DELETE', 'staff', req.params.id);
  res.json({ ok: true });
});

module.exports = router;
