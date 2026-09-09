const { FINANCE_ROLES } = require('../lib/roles');
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');
const { newDocument, footer } = require('../lib/pdf');

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

function recalcStudentBalance(studentId) {
  const totalPaid = db.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE student_id = ?').get(studentId).total;
  const student = db.prepare('SELECT total_fees FROM students WHERE id = ?').get(studentId);
  db.prepare(`UPDATE students SET fees_paid = ?, balance_owing = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(totalPaid, student.total_fees - totalPaid, studentId);
}

router.get('/', requireRole(...FINANCE_ROLES), (req, res) => {
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

router.post('/', requireRole(...FINANCE_ROLES), (req, res) => {
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
    recalcStudentBalance(student_id);
    return info.lastInsertRowid;
  });
  const id = txn();
  logAction(req, 'CREATE', 'payments', id, { student_id, amount: amt, receipt_no: receiptNo });
  res.status(201).json({ id, receipt_no: receiptNo });
});

router.put('/:id', requireRole(...FINANCE_ROLES), (req, res) => {
  const existing = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Payment not found' });
  const { amount, method, notes, payment_date } = req.body || {};
  const amt = amount != null ? Number(amount) : existing.amount;
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Amount must be positive' });

  const txn = db.transaction(() => {
    db.prepare(`
      UPDATE payments SET amount = ?, method = ?, notes = ?, payment_date = ? WHERE id = ?
    `).run(amt, method || existing.method, notes ?? existing.notes, payment_date || existing.payment_date, req.params.id);
    recalcStudentBalance(existing.student_id);
  });
  txn();
  logAction(req, 'UPDATE', 'payments', req.params.id, req.body);
  res.json({ ok: true });
});

router.delete('/:id', requireRole(...FINANCE_ROLES), (req, res) => {
  const existing = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Payment not found' });
  const txn = db.transaction(() => {
    db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
    recalcStudentBalance(existing.student_id);
  });
  txn();
  logAction(req, 'DELETE', 'payments', req.params.id, { receipt_no: existing.receipt_no });
  res.json({ ok: true });
});

router.get('/report.pdf', requireRole(...FINANCE_ROLES), (req, res) => {
  const { from, to } = req.query;
  const where = [];
  const params = {};
  if (from) { where.push('payment_date >= @from'); params.from = from; }
  if (to) { where.push('payment_date <= @to'); params.to = to; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT p.*, s.first_name, s.surname, s.student_id AS student_number, s.program
    FROM payments p JOIN students s ON s.id = p.student_id
    ${whereSql}
    ORDER BY p.payment_date, p.id
  `).all(params);

  const totalCollected = rows.reduce((sum, r) => sum + r.amount, 0);
  const byMethod = {};
  const byProgram = {};
  rows.forEach((r) => {
    byMethod[r.method] = (byMethod[r.method] || 0) + r.amount;
    const prog = r.program || 'Unspecified';
    byProgram[prog] = (byProgram[prog] || 0) + r.amount;
  });
  const outstanding = db.prepare('SELECT COALESCE(SUM(balance_owing),0) AS total FROM students').get().total;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="financial-report.pdf"');

  const doc = newDocument({ title: 'Financial Report' });
  doc.pipe(res);

  const period = [from && `From ${from}`, to && `To ${to}`].filter(Boolean).join('   ') || 'All time';
  doc.fontSize(10).fillColor('#444444').text(`Period: ${period}`);
  doc.fillColor('#000000').moveDown();

  doc.font('Helvetica-Bold').fontSize(13).text(`Total Collected: K${totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
  doc.font('Helvetica').fontSize(10).text(`(${rows.length} payment${rows.length === 1 ? '' : 's'})`);
  doc.text(`Balance Outstanding Across All Students: K${outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
  doc.moveDown();

  doc.font('Helvetica-Bold').fontSize(11).text('By Payment Method');
  doc.font('Helvetica').fontSize(10);
  Object.entries(byMethod).sort((a, b) => b[1] - a[1]).forEach(([method, amt]) => {
    doc.text(`${method}: K${amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
  });
  doc.moveDown();

  doc.font('Helvetica-Bold').fontSize(11).text('By Programme');
  doc.font('Helvetica').fontSize(10);
  Object.entries(byProgram).sort((a, b) => b[1] - a[1]).forEach(([program, amt]) => {
    doc.text(`${program}: K${amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
  });
  doc.moveDown();

  if (rows.length > 0) {
    doc.font('Helvetica-Bold').fontSize(11).text('Payment Detail');
    doc.moveDown(0.3);
    doc.fontSize(9);
    rows.forEach((r) => {
      if (doc.y > doc.page.height - 80) { doc.addPage(); doc.y = 60; }
      const rowY = doc.y;
      doc.font('Helvetica').text(r.payment_date, 50, rowY, { width: 70 });
      doc.text(r.receipt_no, 125, rowY, { width: 110 });
      doc.text(`${r.first_name} ${r.surname}`, 240, rowY, { width: 150 });
      doc.text(r.method, 395, rowY, { width: 80 });
      doc.text(`K${r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 480, rowY, { width: 65, align: 'right' });
      doc.moveDown(0.5);
    });
  }

  footer(doc);
  doc.end();
});

router.get('/:id/receipt', requireRole(...FINANCE_ROLES), (req, res) => {
  const payment = db.prepare(`
    SELECT p.*, s.first_name, s.middle_name, s.surname, s.student_id AS student_number, s.program,
           s.total_fees, s.fees_paid, s.balance_owing
    FROM payments p JOIN students s ON s.id = p.student_id WHERE p.id = ?
  `).get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  res.json(payment);
});

router.get('/:id/receipt.pdf', requireRole(...FINANCE_ROLES), (req, res) => {
  const payment = db.prepare(`
    SELECT p.*, s.first_name, s.middle_name, s.surname, s.student_id AS student_number, s.program,
           s.total_fees, s.fees_paid, s.balance_owing
    FROM payments p JOIN students s ON s.id = p.student_id WHERE p.id = ?
  `).get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${payment.receipt_no}.pdf"`);

  const doc = newDocument({ title: 'Official Receipt' });
  doc.pipe(res);

  const studentName = [payment.first_name, payment.middle_name, payment.surname].filter(Boolean).join(' ');

  doc.fontSize(11);
  doc.text(`Receipt No.: ${payment.receipt_no}`, { continued: false });
  doc.text(`Date: ${payment.payment_date}`);
  doc.moveDown();
  doc.text(`Received from: ${studentName}`);
  doc.text(`Student ID: ${payment.student_number}`);
  if (payment.program) doc.text(`Program: ${payment.program}`);
  doc.moveDown();

  doc.font('Helvetica-Bold').fontSize(20).text(
    `Amount: K${Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    { align: 'left' }
  );
  doc.font('Helvetica').fontSize(11);
  doc.moveDown(0.5);
  doc.text(`Payment method: ${payment.method}`);
  if (payment.notes) doc.text(`Notes: ${payment.notes}`);
  doc.text(`Received by: ${payment.received_by || '—'}`);

  doc.moveDown(1.5);
  doc.rect(50, doc.y, doc.page.width - 100, 90).stroke('#cccccc');
  const boxTop = doc.y + 12;
  doc.fontSize(10);
  doc.text(`Total Fees:`, 65, boxTop);
  doc.text(`K${Number(payment.total_fees).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 200, boxTop);
  doc.text(`Total Paid to Date:`, 65, boxTop + 22);
  doc.text(`K${Number(payment.fees_paid).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 200, boxTop + 22);
  doc.font('Helvetica-Bold');
  doc.text(`Balance Owing:`, 65, boxTop + 44);
  doc.text(`K${Number(payment.balance_owing).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 200, boxTop + 44);
  doc.font('Helvetica');

  doc.moveDown(6);
  doc.text('_________________________', 65, doc.y);
  doc.text('_________________________', 330, doc.y);
  doc.text('Accountant Signature', 65, doc.y + 5);
  doc.text('Official Stamp', 330, doc.y + 5);

  footer(doc, 'This is a system-generated receipt from the Tukuza SIS.');
  doc.end();
});

module.exports = router;
