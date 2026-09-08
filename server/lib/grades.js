// Simple 4.0-scale grade point mapping. Institutions vary; this is a
// reasonable default and can be adjusted here in one place if FPC uses a
// different scale.
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
 * Computes a simple unweighted GPA from a list of result rows (as returned
 * from the `results` table). Only Approved, Exam-type results with a
 * recognized grade are counted — CA marks and unapproved/draft results are
 * excluded since they aren't final.
 */
function computeGPA(results) {
  const graded = results
    .filter((r) => r.type === 'Exam' && r.status === 'Approved')
    .map((r) => gradeToPoints(r.grade))
    .filter((p) => p !== null);
  if (graded.length === 0) return null;
  const sum = graded.reduce((a, b) => a + b, 0);
  return Math.round((sum / graded.length) * 100) / 100;
}

module.exports = { gradeToPoints, computeGPA };
