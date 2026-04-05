# Emotion Tracker

This project rebuilds the flattened app export into a normal local project you can edit in Atom and run from a terminal.

## What It Uses

- Vite + React + TypeScript for the frontend
- Express + TypeScript for the API
- Node's built-in `node:sqlite` for a local file-based database

## Before You Run It

1. Install Node.js `22+` from [nodejs.org](https://nodejs.org/).
2. Open `C:\Users\Druken's Advertise\Documents\emotion-tracker` in Atom.
3. Open a terminal in that folder.

## Run It

```powershell
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:3001`

## Demo Accounts

- Patient: `patient1` / `demo123`
- Support worker: `support1` / `demo123`

These demo accounts are meant for local development only. When `LAMB_PRODUCTION_MODE=true`, the app expects clinician-invite-only onboarding instead of public demo credentials.

## GPS Logging

- Patients can optionally include a one-time GPS snapshot when saving a mood entry.
- Browsers will ask for location permission the first time this is used.
- Support logs show saved coordinates, accuracy, and an `Open map` link when location was captured.

## Structured Check-Ins

- Mood entries now include sleep, stress, cravings, substance-use self-report, money-change context, and medication adherence.
- The support dashboard summarizes these fields and shows neutral follow-up flags like `low sleep`, `high craving`, and `medication adherence concern`.
- These flags are intended to support clinician review and pattern recognition, not to make a diagnosis or prove dishonesty.

## Daily Reports

- Patients now have a separate `Morning report` and `Night report` section on the patient side.
- Morning reports capture bedtime, wake time, sleep quality, wake-ups, and whether the patient feels rested.
- Night reports capture planned bedtime and optional notes about what may make sleep difficult.
- Patients also see a simple `done today / still needed / later today` reminder status for the morning and night report.
- The support dashboard includes a `Daily Sleep Reports` panel with recent reports and sleep-focused summary metrics.

## Clinician Snapshot

- The support dashboard now includes a `Clinician Snapshot` section for the selected patient.
- It generates a copyable summary paragraph, repeated review signals, and simple trend charts for sleep, stress, and cravings.
- This is meant to help staff prepare a handoff or chart note more quickly before a visit.

## Dedicated Doctor Review Page

- Support users can now open a separate doctor-facing review page for the selected patient.
- The doctor page pulls together the visit summary, follow-up questions, recent observations, weekly screening, trend charts, medication list, and care plan in one cleaner layout.
- The page also supports browser print-to-PDF, plus copy actions for the visit summary and visit questions.

## Medications And Care Plan

- A clinician-managed medication list can now be added and updated for each patient.
- A clinician-managed care plan can now be created and updated for each patient, including goals, triggers, warning signs, what helps, support contacts, and preferred follow-up notes.
- These fields are intended for support-worker and clinician use, not patient entry.

## Risk Queue And Weekly Review

- The support dashboard now includes a `Priority Queue` that ranks patients by recent review signals from mood, sleep, medication, and substance-use data.
- Each patient card shows a simple risk level, the main reasons they were flagged, and the most recent data time.
- The selected patient also gets a `Weekly Review` panel with key changes, suggested next steps, data gaps, and copy/download actions for a quick handoff note.
- These rankings are meant to support clinician triage, not replace clinical judgment or make a diagnosis.

## NL Care Pathways

- The support dashboard now includes `NL Care Pathways` quick links for the selected patient.
- Suggested actions change with the current patient risk level and include options like `811`, `Doorways`, `Systems Navigator`, `Lifewise Warmline`, `Bridge the gapp`, and `Patient Connect NL`.
- These are meant to help support workers and clinicians move from pattern review to a real local next step more quickly.

## Secure Pilot Features

- Sign-in now uses secure server-backed sessions with `httpOnly` cookies.
- Passwords are hashed before they are stored.
- Existing data routes now enforce patient ownership or support-staff assignment checks on the server.
- Support users have a separate `Manage Access` page for invite-only onboarding and patient-to-staff assignments.
- Support-facing patient lists now show assigned patients instead of the entire pilot database.
- Patients now see a privacy and consent step before using mood, sleep, weekly-screen, and GPS features.
- GPS stays off by default until separate location consent is accepted.
- Audit logging is recorded for sign-in, record views, and write actions such as mood entries, reports, medications, care plans, invites, assignments, and consent changes.

## Environment Setup

Copy `.env.example` to `.env` and update the values for your environment.
The server and maintenance scripts load `.env` automatically from the project root.

Important live settings:

- `NODE_ENV=production`
- `LAMB_PRODUCTION_MODE=true`
- `SESSION_SECRET=` a strong random secret
- `APP_BASE_URL=` the public app URL used for invite activation links
- `DATABASE_PATH=` the production database location
- `BACKUP_DIR=` where database backups should be written
- `ENABLE_DEMO_SEED=false`

Before the first live pilot sign-in, create the first support account:

```powershell
npm run bootstrap:support -- --username pilot-support --first-name Pilot --last-name Lead
```

The script will prompt for the password if you do not pass one on the command line. After that
first support account exists, use the in-app `Manage Access` page to invite patients and
additional staff.

## Production Build

```powershell
npm run build
npm start
```

For a managed restart strategy, a sample [ecosystem.config.cjs](C:\Users\Druken's Advertise\Documents\emotion-tracker\ecosystem.config.cjs) file is included for PM2-style process management.

For HTTPS in front of the Node app, a sample [Caddyfile.example](C:\Users\Druken's Advertise\Documents\emotion-tracker\deploy\Caddyfile.example) is included in `deploy/`.

## Backup And Restore

Create a backup:

```powershell
npm run backup
```

Restore from a backup file:

```powershell
npm run restore -- .\backups\emotion-tracker-YYYYMMDD-HHMMSS.db
```

Before restoring, stop the running app so the SQLite files are not being written to during the restore.

## Notes

- The SQLite database is created automatically at `data/emotion-tracker.db` unless `DATABASE_PATH` is set.
- Demo patient and support users are only seeded when demo seeding is enabled.
- Data persists between restarts because it is stored in the local SQLite file.
- The server uses Node's built-in `node:sqlite`, so no native SQLite package needs to be compiled during install.
- A public health endpoint is available at `/api/health`.
