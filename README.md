# Tukuza SIS — FPC Student Information Management System

> Student Information System for a College/University that can be installed on a local machine and/or later cloud-based hosting.

A Windows/desktop application for Fountain of Peace University College, built with
**Electron + React (Vite) + Material UI** on the frontend and **Node.js/Express +
SQLite (better-sqlite3)** on the backend. The starting database is seeded from the
legacy `SMS_FPC.xlsm` workbook (Student Details + Academic Staff Data sheets).

## What's included

- **Seven roles with distinct permissions** (JWT-based login): **Super Administrator**
  (everything — users, backups, audit log, academic years, system-wide overrides),
  **Administrator** (students, staff, programmes, departments, reports),
  **Registrar** (register/edit students, manage programmes & intakes),
  **Accountant** (all finance — payments, receipts, financial reports),
  **Lecturer** (enter CA marks & exam results while in Draft),
  **Examinations Officer** (approve/lock results, generate transcripts), and
  **Student** (self-service portal only, scoped to their own record).
- **Student self-service portal**: students log in with their **Student ID as
  username**, and can view their own details, fees, CA marks, exam results (once
  approved), GPA, and download their own fee statement / transcript — nothing
  belonging to other students. An Administrator or Super Administrator creates
  the login from that student's profile page.
- **Student records**: full demographic + academic profile (DOB, nationality,
  contact details, passport photo, department, intake, academic year, year of
  study, semester, six status values), search, add/edit, per-student profile
  with payment history. Student IDs can be entered manually (matching your
  existing scheme) or auto-generated as `TUK/2026/001`. Duplicate NRC/email are
  rejected at the application level.
- **Academic staff records**: imported from the workbook, grouped by department,
  with position and date-employed fields
- **Programmes, Departments & Intakes**: all managed as real data with proper
  fields (code, duration, description, head of department, etc.) instead of free
  text — used as dropdowns throughout the app
- **Course catalog & student registration**: courses (code, name, programme,
  year, semester, credit hours, assigned lecturer), with students registered
  per academic year/semester
- **Results with itemized CA components and a configurable grade scale**:
  Lecturers add any number of named CA components (Assignment, Test, Quiz,
  Practical, ...) — the CA Total, Final Mark (CA + Exam), and Grade/Remark are
  all computed automatically against an editable mark-band table (defaults to
  Distinction/Merit/Credit/Pass/Fail). A real 5-stage workflow —
  **Draft → Submitted → Approved → Published → Locked** — gates who can do
  what at each stage: Lecturers enter and submit; an Examinations Officer
  approves, publishes, and locks; a Super Administrator can revert a stage for
  correction. Students only ever see **Published**/**Locked** results, and GPA
  and the official transcript are computed only from those.
- **Finance**: record, edit, and delete fee payments (Super Administrator/Accountant,
  balances always recalculated from the actual payment history rather than
  incrementally), auto-generated receipt numbers, a date-range financial report
  (by payment method and by programme)
- **PDF documents**: printable payment receipts, front-and-back student ID cards
  (with photo + QR code), per-student fee statements, academic transcripts (with
  GPA), a filterable students report, and a financial report
- **Database backups**: on-demand backup, download, and delete from the Backups page
  (Super Administrator only), an automatic daily backup while the app is open, and
  an optional offsite/cloud mirror (any local folder, including one synced by
  OneDrive/Google Drive/Dropbox) via a native OS folder picker
- **Audit log**: viewable in-app (Super Administrator only) — tracks create/update/
  delete/login/approve/print/download/backup actions
- **Dashboard**: total students/staff, fees collected vs outstanding, students by
  program, staff by department, recent payments (all staff roles)
- **User account management**: create staff accounts, reset passwords, assign a
  Lecturer to a programme, activate/deactivate (Super Administrator only)
- **Data import script** that loads `SMS_FPC.xlsm` into SQLite and can be re-run
  safely to refresh data

### Access control notes

Student accounts can only ever see their own record — they cannot list other
students, browse finance/payments, view the staff directory, or query another
student's results, even by guessing an ID directly against the API. Every one
of the 7 roles' permissions above is enforced server-side (not just hidden in
the UI) and was verified with a dedicated test account per role, not just the
built-in admin — including the full results workflow, where each transition
(submit/approve/publish/lock/revert) was tested against the wrong role to
confirm it's rejected, not just that the right role works.

### Upgrading an existing installation

If you're upgrading from an earlier build, the database migration runs
automatically the first time you launch the new version — no manual steps
needed. A few things to know:

- Your existing `Administrator` account is automatically upgraded to
  **Super Administrator** (the new full-access role) so you don't lose any
  access — the new, narrower `Administrator` role only applies to accounts you
  create from now on.
- If you'd already entered any results under the old CA/Exam-per-row model,
  they're merged automatically into the new one-row-per-course shape (CA rows
  become itemized components, the Exam row becomes the exam score), and any
  grade you'd already entered is carried over as-is rather than silently
  recalculated against the new grade scale.
- Every migration in this release was tested against a full copy of real
  production data (492 students) before being shipped, including foreign-key
  integrity checks and functional insert/update tests — not just "it didn't
  crash."

## Not yet built (planned next sprints, per the project roadmap)

Notifications/announcements, in-app Excel import/export, restore-from-backup,
and a system settings page. SMS/email integration would also need a provider
account (Twilio, an SMTP relay, etc.) this project doesn't have credentials
for. A Windows installer **has** been built and tested (see below) but only by
running the installer's contents programmatically — it has not been run
through an actual Windows install wizard by a human yet, so treat the first
real install as a test.

## Project structure

```
tukuza-sis-project/
├── electron/          # Electron main process + preload
├── server/            # Express API + SQLite database
│   ├── routes/         # auth, students, staff, payments, results, users, dashboard
│   ├── data/            # sms.db (created on first run) + SMS_FPC.xlsm goes here
│   ├── schema.sql       # database schema
│   ├── db.js            # DB connection, schema init, default admin seed
│   └── importFromExcel.js
└── client/            # React + Vite + Material UI frontend
    └── src/
        ├── pages/       # Login, Dashboard, Students, StudentDetail, Staff, Finance, Users
        └── components/  # Layout (nav), ProtectedRoute
```

## Getting started (development, in VS Code)

1. **Install dependencies** (from the project root):
   ```
   npm install
   ```
   This also installs the `client` dependencies automatically (`postinstall` script).

2. **Add the source workbook**: copy `SMS_FPC.xlsm` into `server/data/SMS_FPC.xlsm`
   (it's git-ignored on purpose — see *A note on student data* below).

3. **Import the workbook into the database**:
   ```
   npm run import-data
   ```
   Safe to re-run any time you get an updated workbook — students are matched by
   Student ID and staff by NRC number, so existing records are updated rather than
   duplicated.

4. **Run the app in development**:
   ```
   npm run dev
   ```
   This starts the Vite dev server (port 5173) and opens Electron pointed at it;
   Electron's main process starts the embedded API server itself (port 4000).

## A note on native modules and Electron

`better-sqlite3` is a native (compiled) module, and Electron bundles its own Node.js
runtime with a different ABI than your system Node — a module built for one won't
load in the other. This project handles it as follows:

- `npm install` automatically rebuilds `better-sqlite3` for **Electron's** ABI
  (via the `postinstall` script), since that's what `npm run dev` and the packaged
  app use.
- `npm run import-data` runs the import script *through Electron's own Node runtime*
  (`ELECTRON_RUN_AS_NODE=1`), so it always matches whatever ABI is currently built —
  no manual rebuilding needed for normal use.
- If you ever want to run the API standalone with plain `node` (e.g. `npm run server`
  for quick `curl` testing outside Electron), run `npm run rebuild:node` first, and
  `npm run rebuild:electron` afterward to switch back before using `npm run dev` again.

5. **Sign in** with the default administrator account created on first run:
   - Username: `admin`
   - Password: `Admin@2026`

   **Change this password immediately** (there's no UI for it yet on the admin's
   own account — use the "Reset password" capability via the `/api/users/:id/reset-password`
   endpoint, or the account is exposed on the Users page for other accounts; a
   self-service "change my password" screen is a good next addition).

## Building a distributable app

```
npm run build
```

This builds the React app (`client/dist`) and runs `electron-builder`, which reads
the `build` section of `package.json`. Test this on the target OS — Windows builds
are most reliably produced on Windows or via CI.

## A note on student data

`SMS_FPC.xlsm` and the generated `server/data/sms.db` contain real students' and
staff's names, NRC numbers, and financial information. Both are excluded from git
via `.gitignore` so they are never pushed to GitHub. Please:

- Keep the `tukuza-sis-project` GitHub repository **private**.
- Back up `server/data/sms.db` separately (e.g. encrypted external drive), since it
  is not stored in git.
- Change the default admin password and create named accounts for each real user
  before handing the app to staff, so the audit log is meaningful.

## Pushing this build to GitHub

From inside `tukuza-sis-project/`:

```
git init
git remote add origin https://github.com/chambata/tukuza-sis-project.git
git add .
git commit -m "Initial SIMS build: students, staff, finance, dashboard, auth"
git branch -M main
git push -u origin main
```

If the repository already has commits, use `git pull --rebase origin main` first,
or copy these files over your existing local clone and commit/push from there
(matching your usual workflow).
