const db = require('../db');

/**
 * Looks up the grade + remark for a final mark against the configurable
 * grade_scales table (Administrator/Super Administrator manage the bands).
 * Falls back to null/null if no band covers the mark (e.g. scales don't
 * start at 0, or the mark is out of any configured range).
 */
function computeGrade(finalMark) {
  if (finalMark === null || finalMark === undefined) return { grade: null, remark: null };
  const band = db.prepare(
    'SELECT grade, remark FROM grade_scales WHERE ? >= min_score AND ? <= max_score ORDER BY sort_order LIMIT 1'
  ).get(finalMark, finalMark);
  return band ? { grade: band.grade, remark: band.remark } : { grade: null, remark: null };
}

// Simple 4.0-scale grade point mapping, used only for GPA — separate from the
// grade_scales table (which maps marks -> grade/remark), since GPA needs a
// numeric point value per grade letter. Covers both letter grades and the
// Distinction/Merit/Credit/Pass/Fail remarks used as the default scale.
const GRADE_POINTS = {
  'A+': 4.0, A: 4.0, 'A-': 3.7,
  'B+': 3.3, B: 3.0, 'B-': 2.7,
  'C+': 2.3, C: 2.0, 'C-': 1.7,
  'D+': 1.3, D: 1.0,
  F: 0.0,
  DISTINCTION: 4.0, MERIT: 3.0, CREDIT: 2.0, PASS: 1.0, FAIL: 0.0,
};

function gradeToPoints(grade) {
  if (!grade) return null;
  const key = String(grade).trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(GRADE_POINTS, key) ? GRADE_POINTS[key] : null;
}

/**
 * Computes a simple unweighted GPA from a list of result rows. Only counts
 * results that have been Published (or Locked, which means "was published,
 * now frozen") — Draft/Submitted/Approved results aren't released to the
 * student yet, so they shouldn't move their GPA.
 */
function computeGPA(results) {
  const graded = results
    .filter((r) => (r.status === 'Published' || r.status === 'Locked') && r.grade)
    .map((r) => gradeToPoints(r.grade))
    .filter((p) => p !== null);
  if (graded.length === 0) return null;
  const sum = graded.reduce((a, b) => a + b, 0);
  return Math.round((sum / graded.length) * 100) / 100;
}

module.exports = { computeGrade, gradeToPoints, computeGPA };
