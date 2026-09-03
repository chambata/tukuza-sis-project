const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const totals = db.prepare(`
    SELECT COUNT(*) AS totalStudents,
           COALESCE(SUM(total_fees),0) AS totalFees,
           COALESCE(SUM(fees_paid),0) AS totalPaid,
           COALESCE(SUM(balance_owing),0) AS totalOwing
    FROM students
  `).get();

  const byProgram = db.prepare(`
    SELECT program, COUNT(*) AS count FROM students
    WHERE program IS NOT NULL GROUP BY program ORDER BY count DESC
  `).all();

  const byGender = db.prepare(`
    SELECT COALESCE(gender,'Unspecified') AS gender, COUNT(*) AS count
    FROM students GROUP BY gender
  `).all();

  const byStatus = db.prepare(`
    SELECT status, COUNT(*) AS count FROM students GROUP BY status
  `).all();

  const totalStaff = db.prepare('SELECT COUNT(*) AS c FROM staff').get().c;
  const staffByDept = db.prepare(`
    SELECT d.name AS department, COUNT(*) AS count
    FROM staff s LEFT JOIN departments d ON d.id = s.department_id
    GROUP BY d.name ORDER BY count DESC
  `).all();

  const recentPayments = db.prepare(`
    SELECT p.id, p.receipt_no, p.amount, p.payment_date, s.first_name, s.surname, s.student_id AS student_number
    FROM payments p JOIN students s ON s.id = p.student_id
    ORDER BY p.id DESC LIMIT 10
  `).all();

  res.json({
    totalStudents: totals.totalStudents,
    totalFees: totals.totalFees,
    totalPaid: totals.totalPaid,
    totalOwing: totals.totalOwing,
    totalStaff,
    byProgram,
    byGender,
    byStatus,
    staffByDept,
    recentPayments,
  });
});

module.exports = router;
