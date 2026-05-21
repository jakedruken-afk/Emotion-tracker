# L.A.M.B Mobile Pilot Guide

This guide explains the current patient-first mobile scope, the synthetic demo workflow, and the
guardrails that must stay in place before any supervised participant pilot.

## Current Mobile Scope

L.A.M.B mobile is intentionally narrower than the desktop product. The mobile path is for patient
data capture and sync reliability, not for full clinician parity.

Included in the mobile-ready patient scope:

- invite activation and sign-in
- consent with staffed-hours and emergency-limit acknowledgement
- daily check-ins
- morning and night reports, including meals
- missed-medication follow-up detail capture
- simplified weekly screening
- visible sync state, offline draft save, and queued retry
- crisis-aware submission messaging

Desktop remains the primary home for:

- support triage queue
- alert ownership and acknowledgement
- doctor review
- revision history
- reliability and mismatch review

## Hybrid Mobile Path

The repository is now scaffolded for a Capacitor-based patient shell on both Android and iPhone:

```powershell
npm run mobile:sync
```

### Android-first setup on Windows

1. Install Android Studio and let it install the Android SDK, Platform-Tools, and an emulator image
2. Confirm `adb version` works in a fresh PowerShell session
3. Run `npm install`
4. Run `npm run mobile:sync:android`
5. Open the native project with `npm run mobile:open:android`
6. In Android Studio, open the generated `android/` project, let Gradle sync finish, then run on an emulator or connected Samsung device

Important Android notes:

- The Capacitor Android project now lives under `android/`
- `capacitor.config.ts` keeps the embedded origin at `https://localhost`, so backend allowlists must include that origin
- Native or hybrid shells should use header-based sessions, not cookie-only assumptions

### iPhone work on a Mac

1. Set `VITE_API_BASE_URL=https://your-api-host.example`
2. Run `npm install`
3. Run `npx cap add ios`
4. Run `npm run mobile:sync:ios`
5. Open the native project with `npm run mobile:open:ios`
6. Configure signing, push capability, and TestFlight in Xcode

Important implementation note:

- Native or hybrid shells should use header-based sessions, not cookie-only assumptions.
- The API now accepts `x-lamb-session` and supports the Capacitor origins configured through
  `MOBILE_ALLOWED_ORIGINS`.

## Synthetic Demo Mode

Use synthetic demo mode for internal walkthroughs, investor demos, and staff dry runs.

The support dashboard can now reset fake scenarios for:

- stable low-risk patient
- worsening sleep and meals
- missed medication details
- support-worker mismatch
- critical free-text crisis alert

Synthetic demo mode rules:

- never mix synthetic and live participant data
- do not export or print synthetic patient material as if it were pilot output
- keep demo seeding disabled in production by setting `ENABLE_DEMO_SEED=false`

## Phase A, B, And C

### Phase A: internal or staff-only dry run

- synthetic data only or staff-entered controlled data
- exercise offline retry, consent comprehension, and critical-alert ownership
- no promise of live or continuous monitoring

### Phase B: supervised low-risk participant pilot

- patient mobile flow only
- clinician review stays on desktop
- staffed-hours monitoring only
- minimum-necessary data collection

### Phase C: broader real-world pilot

Move here only after the go/no-go thresholds are met and the operational workflow has been proven
in dry runs and supervised pilot use.

## Crisis Boundaries

The app must never imply 24/7 emergency monitoring.

Before live participant use, keep all of the following in place:

- staffed-hours language in consent and risky-submission messaging
- a named alert owner for each critical alert
- acknowledgement timestamps on critical alerts
- an escalation SOP that defines primary owner, backup owner, and response expectations
- clear patient messaging that urgent danger still requires direct emergency help

## Go / No-Go Thresholds

Do not move from staff-only testing to supervised participant use unless all of these are true:

- no known critical auth, privacy, or cross-patient-access defects
- at least 99% of online submissions sync within 60 seconds during dry runs
- at least 95% of queued offline submissions recover within 15 minutes of reconnecting
- zero unrecoverable entry-loss events in dry-run testing
- at least 90% consent-comprehension success in staff rehearsal or onboarding checks
- 100% of critical alerts receive a named owner
- at least 95% of critical alerts are acknowledged within the staffed-hours SLA
- at least 85% of entries are clinically usable
- at least 80% of `missed_some` medication answers include follow-up detail

## Pilot Metrics

The support dashboard now exposes a pilot snapshot fed by `/api/pilot-metrics`.

Current tracked areas include:

- activation and consent completion
- clinically usable entry rate
- edit, suspicious-edit, and reliability-flag rates
- meals completeness
- missed-medication detail capture
- consistency over time
- critical-alert acknowledgement rate and timing

Use those metrics to judge pilot readiness before broadening access.
