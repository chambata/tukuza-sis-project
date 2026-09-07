const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('Administrator'));

router.get('/', (req, res) => {
  const { limit = '100' } = req.query;
  const rows = db.prepare(
    'SELECT * FROM audit_log ORDER BY id DESC LIMIT ?'
  ).all(Math.min(500, parseInt(limit, 10) || 100));
  res.json(rows);
});

module.exports = router;
