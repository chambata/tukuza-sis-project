-- Tukuza SIS database schema

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('Super Administrator','Administrator','Registrar','Accountant','Lecturer','Examinations Officer','Student')),
  linked_student_id INTEGER REFERENCES students(id),
  assigned_program TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  code TEXT,
  head_of_department TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS programmes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  code TEXT,
  department_id INTEGER REFERENCES departments(id),
  duration_years REAL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS academic_years (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT UNIQUE NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS intakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT UNIQUE NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sn INTEGER,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  surname TEXT NOT NULL,
  gender TEXT,
  date_of_birth TEXT,
  nationality TEXT,
  phone_number TEXT,
  email TEXT,
  residential_address TEXT,
  passport_photo TEXT,
  student_id TEXT UNIQUE NOT NULL,
  nrc_no TEXT,
  total_fees REAL NOT NULL DEFAULT 0,
  fees_paid REAL NOT NULL DEFAULT 0,
  balance_owing REAL NOT NULL DEFAULT 0,
  year_of_graduation TEXT,
  program TEXT,
  department_id INTEGER REFERENCES departments(id),
  intake_id INTEGER REFERENCES intakes(id),
  academic_year TEXT,
  year_of_study INTEGER,
  semester TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Graduated','Deferred','Withdrawn','Suspended','Completed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sn INTEGER,
  title TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  gender TEXT,
  dob TEXT,
  age INTEGER,
  nrc_number TEXT,
  passport_no TEXT,
  nationality TEXT,
  email TEXT,
  phone_number TEXT,
  postal_address TEXT,
  disability TEXT,
  academic_rank TEXT,
  position TEXT,
  date_employed TEXT,
  highest_level_of_study TEXT,
  field_of_study TEXT,
  mode_of_employment TEXT,
  department_id INTEGER REFERENCES departments(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  receipt_no TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  payment_date TEXT NOT NULL DEFAULT (date('now')),
  method TEXT NOT NULL DEFAULT 'Cash' CHECK (method IN ('Cash','Bank Transfer','Mobile Money','Cheque','Card','EFT','Other')),
  reference_no TEXT,
  received_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code TEXT UNIQUE NOT NULL,
  course_name TEXT NOT NULL,
  programme_id INTEGER REFERENCES programmes(id),
  year_of_study INTEGER,
  semester TEXT,
  credit_hours REAL,
  lecturer_user_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS student_courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  academic_year TEXT,
  semester TEXT,
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, course_id, academic_year, semester)
);

CREATE TABLE IF NOT EXISTS grade_scales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  min_score REAL NOT NULL,
  max_score REAL NOT NULL,
  grade TEXT NOT NULL,
  remark TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id),
  course_name TEXT NOT NULL,
  academic_year TEXT,
  semester TEXT,
  ca_total REAL NOT NULL DEFAULT 0,
  exam_score REAL,
  final_mark REAL,
  grade TEXT,
  remark TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Submitted','Approved','Published','Locked')),
  entered_by TEXT,
  submitted_by TEXT,
  submitted_at TEXT,
  approved_by TEXT,
  approved_at TEXT,
  published_by TEXT,
  published_at TEXT,
  locked_by TEXT,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assessment_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  result_id INTEGER NOT NULL REFERENCES results(id) ON DELETE CASCADE,
  component_name TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  max_score REAL NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  username TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'All Users' CHECK (target IN ('All Students','Specific Programme','Lecturers','Staff','All Users')),
  target_programme TEXT,
  created_by TEXT,
  created_by_user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  related_entity TEXT,
  related_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_students_program ON students(program);
CREATE INDEX IF NOT EXISTS idx_students_surname ON students(surname);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_staff_department ON staff(department_id);
CREATE INDEX IF NOT EXISTS idx_results_student ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_components_result ON assessment_components(result_id);
CREATE INDEX IF NOT EXISTS idx_student_courses_student ON student_courses(student_id);
CREATE INDEX IF NOT EXISTS idx_student_courses_course ON student_courses(course_id);
CREATE INDEX IF NOT EXISTS idx_courses_programme ON courses(programme_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
-- Note: indexes on columns added by a later migration (students.department_id,
-- students.intake_id, programmes.department_id) are created in db.js *after*
-- those migrations run, not here — this file also runs unconditionally
-- against pre-migration databases, where those columns don't exist yet.
