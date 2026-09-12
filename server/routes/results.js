const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');
const { computeGrade } = require('../lib/grades');
const { RESULTS_ENTRY_ROLES, RESULTS_APPROVAL_ROLES, SUPER_ADMIN, STUDENT } = require('../lib/roles');
const { notifyStudent } = require('../lib/notifications');

const router = express.Router();
router.use(requireAuth);

function withComponents(result) {
  const components = db.prepare(
    'SELECT * FROM assessment_components WHERE result_id = ? ORDER BY id'
  ).all(result.id);
  return { ...result, components };
}

function recompute(resultId, examScore) {
  const components = db.prepare('SELECT * FROM assessment_components WHERE result_id = ?').all(resultId);
  const caTotal = components.reduce((sum, c) => sum + (c.score || 0), 0);
  const finalMark = caTotal + (examScore || 0);
  const { grade, remark } = computeGrade(finalMark);
  db.prepare(`
    UPDATE results SET ca_total = ?, exam_score = ?, final_mark = ?, grade = ?, remark = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(caTotal, examScore, finalMark, grade, remark, resultId);
}

router.get('/', (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return res.status(400).json({ error: 'studentId query param required' });
  if (req.user.role === STUDENT && String(req.user.linked_student_id) !== String(studentId)) {
    return res.status(403).json({ error: 'You do not have permission to view these results' });
  }
  let rows = db.prepare(
    'SELECT * FROM results WHERE student_id = ? ORDER BY academic_year DESC, semester, course_name'
  ).all(studentId);
  // Students only see results that have actually been released.
  if (req.user.role === STUDENT) {
    rows = rows.filter((r) => r.status === 'Published' || r.status === 'Locked');
  }
  res.json(rows.map(withComponents));
});

router.post('/', requireRole(...RESULTS_ENTRY_ROLES), (req, res) => {
  const { student_id, course_id, course_name, academic_year, semester, components, exam_score } = req.body || {};
  if (!student_id || !course_name) {
    return res.status(400).json({ error: 'student_id and course_name are required' });
  }
  const txn = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO results (student_id, course_id, course_name, academic_year, semester, status, entered_by)
      VALUES (?, ?, ?, ?, ?, 'Draft', ?)
    `).run(student_id, course_id || null, course_name, academic_year || null, semester || null, req.user.full_name || req.user.username);
    const resultId = info.lastInsertRowid;
    (components || []).forEach((c) => {
      db.prepare('INSERT INTO assessment_components (result_id, component_name, score, max_score) VALUES (?, ?, ?, ?)')
        .run(resultId, c.component_name, Number(c.score) || 0, Number(c.max_score) || 100);
    });
    recompute(resultId, exam_score != null ? Number(exam_score) : null);
    return resultId;
  });
  const id = txn();
  logAction(req, 'CREATE', 'results', id, { student_id, course_name, academic_year, semester });
  res.status(201).json({ id });
});

router.put('/:id', requireRole(...RESULTS_ENTRY_ROLES), (req, res) => {
  const existing = db.prepare('SELECT * FROM results WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Result not found' });
  if (existing.status !== 'Draft' && req.user.role !== SUPER_ADMIN) {
    return res.status(403).json({ error: `This result is ${existing.status} and can no longer be edited here (a Super Administrator can override)` });
  }
  const { course_name, academic_year, semester, components, exam_score } = req.body || {};
  const txn = db.transaction(() => {
    db.prepare(`
      UPDATE results SET course_name = COALESCE(?, course_name), academic_year = COALESCE(?, academic_year),
        semester = COALESCE(?, semester) WHERE id = ?
    `).run(course_name || null, academic_year || null, semester || null, req.params.id);
    if (components) {
      db.prepare('DELETE FROM assessment_components WHERE result_id = ?').run(req.params.id);
      components.forEach((c) => {
        db.prepare('INSERT INTO assessment_components (result_id, component_name, score, max_score) VALUES (?, ?, ?, ?)')
          .run(req.params.id, c.component_name, Number(c.score) || 0, Number(c.max_score) || 100);
      });
    }
    const finalExamScore = exam_score !== undefined ? (exam_score === null ? null : Number(exam_score)) : existing.exam_score;
    recompute(req.params.id, finalExamScore);
  });
  txn();
  logAction(req, 'UPDATE', 'results', req.params.id, req.body);
  res.json({ ok: true });
});

// --- Workflow transitions: Draft -> Submitted -> Approved -> Published -> Locked ---

function transition(fromStatus, toStatus, roles, actorFields, onSuccess) {
  return [requireRole(...roles), (req, res) => {
    const existing = db.prepare('SELECT * FROM results WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Result not found' });
    if (existing.status !== fromStatus && req.user.role !== SUPER_ADMIN) {
      return res.status(409).json({ error: `This result is ${existing.status}, not ${fromStatus} — cannot ${toStatus.toLowerCase()} it` });
    }
    const actor = req.user.full_name || req.user.username;
    const setClauses = [`status = '${toStatus}'`, ...actorFields.map((f) => `${f} = @${f}`)];
    const params = {};
    actorFields.forEach((f) => {
      params[f] = f.endsWith('_by') ? actor : new Date().toISOString();
    });
    db.prepare(`UPDATE results SET ${setClauses.join(', ')} WHERE id = @id`).run({ ...params, id: req.params.id });
    logAction(req, toStatus.toUpperCase(), 'results', req.params.id);
    if (onSuccess) onSuccess(existing);
    res.json({ ok: true });
  }];
}

router.put('/:id/submit', ...transition('Draft', 'Submitted', RESULTS_ENTRY_ROLES, ['submitted_by', 'submitted_at']));
router.put('/:id/approve', ...transition('Submitted', 'Approved', RESULTS_APPROVAL_ROLES, ['approved_by', 'approved_at']));
router.put('/:id/publish', ...transition('Approved', 'Published', RESULTS_APPROVAL_ROLES, ['published_by', 'published_at'], (result) => {
  notifyStudent(result.student_id, 'RESULT_PUBLISHED', `Your result for ${result.course_name} has been published`, 'results', result.id);
}));
router.put('/:id/lock', ...transition('Published', 'Locked', RESULTS_APPROVAL_ROLES, ['locked_by', 'locked_at']));

// Moves a result back one workflow stage (e.g. Published -> Approved) for
// corrections. Deliberately restricted to Super Administrator only, since it
// bypasses the normal approval chain.
const STAGE_ORDER = ['Draft', 'Submitted', 'Approved', 'Published', 'Locked'];
router.put('/:id/revert', requireRole(SUPER_ADMIN), (req, res) => {
  const existing = db.prepare('SELECT * FROM results WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Result not found' });
  const idx = STAGE_ORDER.indexOf(existing.status);
  if (idx <= 0) return res.status(400).json({ error: 'This result is already at the earliest stage' });
  const previousStage = STAGE_ORDER[idx - 1];
  db.prepare('UPDATE results SET status = ? WHERE id = ?').run(previousStage, req.params.id);
  logAction(req, 'REVERT', 'results', req.params.id, { from: existing.status, to: previousStage });
  res.json({ ok: true, status: previousStage });
});

router.delete('/:id', requireRole(...RESULTS_ENTRY_ROLES), (req, res) => {
  const existing = db.prepare('SELECT * FROM results WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Result not found' });
  if (existing.status !== 'Draft' && req.user.role !== SUPER_ADMIN) {
    return res.status(403).json({ error: `This result is ${existing.status} and can only be deleted by a Super Administrator` });
  }
  db.prepare('DELETE FROM results WHERE id = ?').run(req.params.id);
  logAction(req, 'DELETE', 'results', req.params.id);
  res.json({ ok: true });
});

module.exports = router;
