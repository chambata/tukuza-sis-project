const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');

const router = express.Router();
router.use(requireAuth);

function nextReceiptNo() {
  const year = new Date().getFullYear();
  const row = db.prepare(
    `SELECT receipt_no FROM payments WHERE receipt_no LIKE ? ORDER BY id DESC LIMIT 1`
  ).get(`FPC-${year}-%`);
  let seq = 1;
  if (row) {
    const parts = row.receipt_no.split('-');
    seq = (parseInt(parts[2], 10) || 0) + 1;
  }
  return `FPC-${year}-${String(seq).padStart(5, '0')}`;
}

router.get('/', (req, res) => {
  const { studentId } = req.query;
  if (studentId) {
    return res.json(db.prepare('SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC, id DESC').all(studentId));
  }
  const { from, to } = req.query;
  const where = [];
  const params = {};
  if (from) { where.push('payment_date >= @from'); params.from = from; }
  if (to) { where.push('payment_date <= @to'); params.to = to; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT p.*, s.first_name, s.surname, s.student_id AS student_number
    FROM payments p JOIN students s ON s.id = p.student_id
    ${whereSql}
    ORDER BY p.payment_date DESC, p.id DESC LIMIT 500
  `).all(params);
  res.json(rows);
});

router.post('/', requireRole('Administrator', 'Accountant'), (req, res) => {
  const { student_id, amount, method, notes, payment_date } = req.body || {};
  const amt = Number(amount);
  if (!student_id || !amt || amt <= 0) {
    return res.status(400).json({ error: 'student_id and a positive amount are required' });
  }
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const receiptNo = nextReceiptNo();
  const txn = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO payments (student_id, receipt_no, amount, payment_date, method, received_by, notes)
      VALUES (@student_id, @receipt_no, @amount, @payment_date, @method, @received_by, @notes)
    `).run({
      student_id,
      receipt_no: receiptNo,
      amount: amt,
      payment_date: payment_date || new Date().toISOString().slice(0, 10),
      method: method || 'Cash',
      received_by: req.user.full_name || req.user.username,
      notes: notes || null,
    });
    const newPaid = student.fees_paid + amt;
    db.prepare(`
      UPDATE students SET fees_paid = ?, balance_owing = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newPaid, student.total_fees - newPaid, student_id);
    return info.lastInsertRowid;
  });
  const id = txn();
  logAction(req, 'CREATE', 'payments', id, { student_id, amount: amt, receipt_no: receiptNo });
  res.status(201).json({ id, receipt_no: receiptNo });
});

router.get('/:id/receipt', (req, res) => {
  const payment = db.prepare(`
    SELECT p.*, s.first_name, s.middle_name, s.surname, s.student_id AS student_number, s.program,
           s.total_fees, s.fees_paid, s.balance_owing
    FROM payments p JOIN students s ON s.id = p.student_id WHERE p.id = ?
  `).get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  res.json(payment);
});

module.exports = router;
