# Tukuza SIS — FPC Student Information Management System

> Student Information System for a College/University that can be installed on a local machine and/or later cloud-based hosting.

A Windows/desktop application for Fountain of Peace University College, built with
**Electron + React (Vite) + Material UI** on the frontend and **Node.js/Express +
SQLite (better-sqlite3)** on the backend. The starting database is seeded from the
legacy `SMS_FPC.xlsm` workbook (Student Details + Academic Staff Data sheets).

## What's included in this first build

- **Authentication & roles**: Administrator, Lecturer, Accountant, Student (JWT-based login)
- **Student records**: search, add/edit, per-student profile with payment history
- **Academic staff records**: imported from the workbook, grouped by department
- **Finance**: record fee payments, auto-generated receipt numbers, running balances
- **Results**: basic per-student results table (API ready; UI to be expanded in a future sprint)
- **Dashboard**: total students/staff, fees collected vs outstanding, students by
  program, staff by department, recent payments
- **User account management** (Administrator only)
- **Audit log** of create/update/delete/login actions (database table; UI to come)
- **Data import script** that loads `SMS_FPC.xlsm` into SQLite and can be re-run
  safely to refresh data

## Not yet built (planned next sprints, per the project roadmap)

PDF report generation, student ID cards / QR codes, database backups, SMS/email
integration, a polished results/grades UI, and the final Windows installer
(`Setup.exe`) via `electron-builder` (the config is already in `package.json` —
running `npm run build` will produce installers, but it hasn't been tested on a
Windows machine yet).

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
   This starts the Express API (port 4000), the Vite dev server (port 5173), and
   opens the Electron window pointed at the dev server, all together.

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
