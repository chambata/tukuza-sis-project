-- Tukuza SIS database schema

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('Administrator','Lecturer','Accountant','Student')),
  linked_student_id INTEGER REFERENCES students(id),
  assigned_program TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS programmes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS academic_years (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT UNIQUE NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sn INTEGER,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  surname TEXT NOT NULL,
  gender TEXT,
  student_id TEXT UNIQUE NOT NULL,
  nrc_no TEXT,
  total_fees REAL NOT NULL DEFAULT 0,
  fees_paid REAL NOT NULL DEFAULT 0,
  balance_owing REAL NOT NULL DEFAULT 0,
  year_of_graduation TEXT,
  program TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Graduated','Deferred','Withdrawn')),
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
  method TEXT NOT NULL DEFAULT 'Cash' CHECK (method IN ('Cash','Bank Transfer','Mobile Money','Cheque','Card')),
  received_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Exam' CHECK (type IN ('CA','Exam')),
  academic_year TEXT,
  semester TEXT,
  score REAL,
  grade TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Approved')),
  entered_by TEXT,
  approved_by TEXT,
  approved_at TEXT,
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

CREATE INDEX IF NOT EXISTS idx_students_program ON students(program);
CREATE INDEX IF NOT EXISTS idx_students_surname ON students(surname);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_staff_department ON staff(department_id);
