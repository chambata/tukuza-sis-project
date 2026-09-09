const { SYSTEM_ADMIN_ROLES } = require('../lib/roles');
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole(...SYSTEM_ADMIN_ROLES));

router.get('/', (req, res) => {
  const { limit = '100' } = req.query;
  const rows = db.prepare(
    'SELECT * FROM audit_log ORDER BY id DESC LIMIT ?'
  ).all(Math.min(500, parseInt(limit, 10) || 100));
  res.json(rows);
});

module.exports = router;
