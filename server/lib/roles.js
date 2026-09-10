// Central definition of the 7 roles and common groupings, so route files
// don't each hardcode their own role-name strings (a typo here would be a
// silent permission bug, not a crash).
const SUPER_ADMIN = 'Super Administrator';
const ADMINISTRATOR = 'Administrator';
const REGISTRAR = 'Registrar';
const ACCOUNTANT = 'Accountant';
const LECTURER = 'Lecturer';
const EXAMS_OFFICER = 'Examinations Officer';
const STUDENT = 'Student';

const ALL_ROLES = [SUPER_ADMIN, ADMINISTRATOR, REGISTRAR, ACCOUNTANT, LECTURER, EXAMS_OFFICER, STUDENT];

// Everyone except Student — used for read access to staff-facing screens
// (dashboard, student directory, staff directory) where the exact role
// doesn't matter, only "is this a staff member".
const STAFF_ROLES = [SUPER_ADMIN, ADMINISTRATOR, REGISTRAR, ACCOUNTANT, LECTURER, EXAMS_OFFICER];

// Can create/edit student demographic & academic records
const STUDENT_WRITE_ROLES = [SUPER_ADMIN, ADMINISTRATOR, REGISTRAR];

// Can manage programmes
const PROGRAMME_WRITE_ROLES = [SUPER_ADMIN, ADMINISTRATOR, REGISTRAR];

// Can manage intakes
const INTAKE_WRITE_ROLES = [SUPER_ADMIN, REGISTRAR];

// Can manage departments and staff records
const DEPARTMENT_WRITE_ROLES = [SUPER_ADMIN, ADMINISTRATOR];

// Can record/edit/delete payments
const FINANCE_ROLES = [SUPER_ADMIN, ACCOUNTANT];

// Can enter CA/exam marks (while in Draft)
const RESULTS_ENTRY_ROLES = [SUPER_ADMIN, ADMINISTRATOR, LECTURER];

// Can approve/publish/lock results
const RESULTS_APPROVAL_ROLES = [SUPER_ADMIN, EXAMS_OFFICER];

// Full system administration: users, backups, audit log, settings
const SYSTEM_ADMIN_ROLES = [SUPER_ADMIN];

// Can manage the course catalog
const COURSE_WRITE_ROLES = [SUPER_ADMIN, ADMINISTRATOR];

// Can register/remove a student's course enrollment
const COURSE_REGISTRATION_ROLES = [SUPER_ADMIN, ADMINISTRATOR, REGISTRAR];

// Can configure the grade scale (mark bands -> grade/remark)
const GRADE_SCALE_WRITE_ROLES = [SUPER_ADMIN, ADMINISTRATOR];

module.exports = {
  SUPER_ADMIN, ADMINISTRATOR, REGISTRAR, ACCOUNTANT, LECTURER, EXAMS_OFFICER, STUDENT,
  ALL_ROLES, STAFF_ROLES, STUDENT_WRITE_ROLES, PROGRAMME_WRITE_ROLES, INTAKE_WRITE_ROLES,
  DEPARTMENT_WRITE_ROLES, FINANCE_ROLES, RESULTS_ENTRY_ROLES, RESULTS_APPROVAL_ROLES,
  SYSTEM_ADMIN_ROLES, COURSE_WRITE_ROLES, COURSE_REGISTRATION_ROLES, GRADE_SCALE_WRITE_ROLES,
};
