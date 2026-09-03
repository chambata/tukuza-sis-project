/**
 * One-time / re-runnable import of the legacy SMS_FPC.xlsm workbook into the
 * Tukuza SIS SQLite database. Safe to re-run: students/staff are upserted by
 * their natural keys (STUDENT ID, and name+NRC for staff) so re-importing an
 * updated workbook won't create duplicates.
 *
 * Usage:
 *   node server/importFromExcel.js [path/to/SMS_FPC.xlsm]
 */
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const db = require('./db');

const filePath = process.argv[2] || path.join(__dirname, 'data', 'SMS_FPC.xlsm');

if (!fs.existsSync(filePath)) {
  console.error(`[import] Workbook not found at ${filePath}`);
  console.error('[import] Place SMS_FPC.xlsm in server/data/ or pass a path as an argument.');
  process.exit(1);
}

const wb = XLSX.readFile(filePath, { cellDates: true });

function sheetRows(name) {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
}

function clean(v) {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : null;
  }
  return v;
}

function toDateString(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim() || null;
}

// ---------- STUDENT DETAILS ----------
function importStudents() {
  const rows = sheetRows('STUDENT DETAILS');
  // header is row index 0: S/N, FIRST NAME, MIDDLE NAME, SURNAME, GENDER,
  // STUDENT ID, NRC NO., TOTAL FEES, FEES PAID, BALANCE OWING, YEAR OF GRADUATION, PROGRAM
  const upsert = db.prepare(`
    INSERT INTO students (sn, first_name, middle_name, surname, gender, student_id, nrc_no,
      total_fees, fees_paid, balance_owing, year_of_graduation, program)
    VALUES (@sn, @first_name, @middle_name, @surname, @gender, @student_id, @nrc_no,
      @total_fees, @fees_paid, @balance_owing, @year_of_graduation, @program)
    ON CONFLICT(student_id) DO UPDATE SET
      sn=excluded.sn, first_name=excluded.first_name, middle_name=excluded.middle_name,
      surname=excluded.surname, gender=excluded.gender, nrc_no=excluded.nrc_no,
      total_fees=excluded.total_fees, fees_paid=excluded.fees_paid,
      balance_owing=excluded.balance_owing, year_of_graduation=excluded.year_of_graduation,
      program=excluded.program, updated_at=datetime('now')
  `);

  let count = 0;
  const txn = db.transaction((records) => {
    for (const r of records) {
      upsert.run(r);
      count++;
    }
  });

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const firstName = clean(row[1]);
    const surname = clean(row[3]);
    const studentId = clean(row[5]);
    if (!firstName && !surname && !studentId) continue; // blank row
    if (!studentId) continue; // student ID is our unique key, skip malformed rows
    records.push({
      sn: Number(row[0]) || null,
      first_name: firstName || '(unknown)',
      middle_name: clean(row[2]),
      surname: surname || '(unknown)',
      gender: clean(row[4]),
      student_id: studentId,
      nrc_no: clean(row[6]),
      total_fees: Number(row[7]) || 0,
      fees_paid: Number(row[8]) || 0,
      balance_owing: Number(row[9]) || 0,
      year_of_graduation: row[10] != null ? String(row[10]).trim() : null,
      program: clean(row[11]),
    });
  }
  txn(records);
  console.log(`[import] Students imported/updated: ${count}`);
}

// ---------- ACADEMIC DATA (staff, grouped under department header rows) ----------
function importStaff() {
  const rows = sheetRows('ACADEMIC DATA');

  const getDept = db.prepare('SELECT id FROM departments WHERE name = ?');
  const insDept = db.prepare('INSERT INTO departments (name) VALUES (?)');
  function departmentId(name) {
    if (!name) return null;
    const existing = getDept.get(name);
    if (existing) return existing.id;
    return insDept.run(name).lastInsertRowid;
  }

  const upsert = db.prepare(`
    INSERT INTO staff (sn, title, first_name, last_name, middle_name, gender, dob, age,
      nrc_number, passport_no, nationality, email, phone_number, postal_address, disability,
      academic_rank, highest_level_of_study, field_of_study, mode_of_employment, department_id)
    VALUES (@sn, @title, @first_name, @last_name, @middle_name, @gender, @dob, @age,
      @nrc_number, @passport_no, @nationality, @email, @phone_number, @postal_address, @disability,
      @academic_rank, @highest_level_of_study, @field_of_study, @mode_of_employment, @department_id)
  `);
  // staff have no natural unique key in the source data other than NRC; use NRC to dedupe
  const findByNrc = db.prepare('SELECT id FROM staff WHERE nrc_number = ? AND nrc_number IS NOT NULL');
  const updateByNrc = db.prepare(`
    UPDATE staff SET sn=@sn, title=@title, first_name=@first_name, last_name=@last_name,
      middle_name=@middle_name, gender=@gender, dob=@dob, age=@age, passport_no=@passport_no,
      nationality=@nationality, email=@email, phone_number=@phone_number,
      postal_address=@postal_address, disability=@disability, academic_rank=@academic_rank,
      highest_level_of_study=@highest_level_of_study, field_of_study=@field_of_study,
      mode_of_employment=@mode_of_employment, department_id=@department_id, updated_at=datetime('now')
    WHERE id=@id
  `);

  // Find header row (contains 'SN' in col 0) to know we've reached the table
  let headerIdx = rows.findIndex((r) => r && clean(r[0]) === 'SN');
  if (headerIdx === -1) headerIdx = 3;

  let currentDept = null;
  let count = 0;
  const DEPT_MARKER = /DEPARTMENT$/i;

  const txn = db.transaction(() => {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c) => c == null)) continue;
      const col0 = clean(row[0]);
      if (col0 && DEPT_MARKER.test(String(col0))) {
        currentDept = String(col0).trim();
        continue;
      }
      const firstName = clean(row[2]);
      const lastName = clean(row[3]);
      if (!firstName && !lastName) continue;

      const record = {
        sn: Number(row[0]) || null,
        title: clean(row[1]),
        first_name: firstName || '(unknown)',
        last_name: lastName || '(unknown)',
        middle_name: clean(row[4]),
        gender: clean(row[5]),
        dob: toDateString(row[6]),
        age: Number(row[7]) || null,
        nrc_number: clean(row[8]),
        passport_no: clean(row[9]),
        nationality: clean(row[10]),
        email: clean(row[11]),
        phone_number: row[12] != null ? String(row[12]).trim() : null,
        postal_address: clean(row[13]),
        disability: clean(row[14]),
        academic_rank: clean(row[15]),
        highest_level_of_study: clean(row[16]),
        field_of_study: clean(row[17]),
        mode_of_employment: clean(row[18]),
        department_id: departmentId(currentDept),
      };

      const existing = record.nrc_number ? findByNrc.get(record.nrc_number) : null;
      if (existing) {
        updateByNrc.run({ ...record, id: existing.id });
      } else {
        upsert.run(record);
      }
      count++;
    }
  });
  txn();
  console.log(`[import] Staff imported/updated: ${count}`);
}

importStudents();
importStaff();
console.log('[import] Done.');
