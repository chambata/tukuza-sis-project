# Tukuza SIS — FPC Student Information Management System

> Student Information System for a College/University that can be installed on a local machine and/or later cloud-based hosting.

A Windows/desktop application for Fountain of Peace University College, built with
**Electron + React (Vite) + Material UI** on the frontend and **Node.js/Express +
SQLite (better-sqlite3)** on the backend. The starting database is seeded from the
legacy `SMS_FPC.xlsm` workbook (Student Details + Academic Staff Data sheets).

## What's included

- **Authentication & roles**: Administrator, Lecturer, Accountant, Student (JWT-based login)
- **Student records**: search, add/edit, per-student profile with payment history
- **Academic staff records**: imported from the workbook, grouped by department
- **Finance**: record fee payments, auto-generated receipt numbers, running balances
- **Results**: per-student results entry (Administrator/Lecturer), viewable on the
  student profile, plus an unofficial transcript PDF
- **PDF documents**: printable payment receipts, student ID cards (with QR code),
  per-student fee statements, academic transcripts, and a filterable students report
- **Database backups**: on-demand backup, download, and delete from the Backups page
  (Administrator only), plus an automatic daily backup that runs while the app is open
- **Audit log**: viewable in-app (Administrator only) — tracks create/update/delete/
  login/print/download/backup actions
- **Dashboard**: total students/staff, fees collected vs outstanding, students by
  program, staff by department, recent payments
- **User account management** (Administrator only)
- **Data import script** that loads `SMS_FPC.xlsm` into SQLite and can be re-run
  safely to refresh data

## Not yet built (planned next sprints, per the project roadmap)

SMS/email integration and offsite/cloud backup sync. A Windows installer **has**
been built and tested (see below) but only by running the installer's contents
programmatically — it has not been run through an actual Windows install wizard
by a human yet, so treat the first real install as a test.

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
