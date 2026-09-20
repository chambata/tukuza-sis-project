-- Tukuza SIS Web Portal — this database is a READ-ONLY REPLICA. Every table
-- here is fully replaced on each sync from the desktop app; nothing a
-- student or visitor does through this portal ever writes back to it except
-- session/login bookkeeping (there is none — auth is stateless JWT).

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY,
  student_id TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  surname TEXT NOT NULL,
  gender TEXT,
  program TEXT,
  year_of_graduation TEXT,
  status TEXT,
  total_fees REAL NOT NULL DEFAULT 0,
  fees_paid REAL NOT NULL DEFAULT 0,
  balance_owing REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL,
  receipt_no TEXT,
  amount REAL NOT NULL,
  payment_date TEXT,
  method TEXT
);

CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL,
  course_name TEXT NOT NULL,
  academic_year TEXT,
  semester TEXT,
  ca_total REAL,
  exam_score REAL,
  final_mark REAL,
  grade TEXT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS programmes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  duration_years REAL
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target TEXT,
  target_programme TEXT,
  created_by TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_results_student ON results(student_id);
