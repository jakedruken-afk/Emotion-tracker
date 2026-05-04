# L.A.M.B. Beta Launch Notes

These notes summarize the current deployment shape and the next work needed for an invite-only beta. This file is intentionally sanitized for GitHub: do not add passwords, recovery codes, JWT secrets, database IDs, private account details, or real patient information here.

## Current Deployment Shape

L.A.M.B. is now organized as one frontend with two delivery targets:

- A React/Vite web app hosted through Cloudflare Pages.
- An iPhone app built with Capacitor/iOS from the same frontend bundle.
- A Cloudflare Worker backend using Hono.
- A Cloudflare D1 database for app data.

The web app and iPhone app should both call the same backend API through `VITE_API_BASE_URL`.

## Backend

The backend Worker includes:

- Hono API routes.
- D1 database access through a `DB` binding.
- JWT-based authentication.
- PBKDF2-SHA256 password hashing.
- Role-aware access checks for patients, doctors, and support workers.
- Patient logs, structured meal/medication/substance tracking, alerts, summaries, and risk scoring.
- Audit trails through access logs and log edit history.

Keep runtime secrets in Cloudflare Worker secrets, not in source control.

## Database

The D1 schema includes tables for:

- Users and roles.
- Patient care-team assignments.
- Daily logs and log edit history.
- Medications and medication logs.
- Meal and substance logs.
- Risk scores.
- Alerts.
- Access audit logs.

Use fake data for early beta testing. Do not enter real clinical information until consent, privacy, security, and operational procedures are ready.

## Frontend And Mobile

The frontend build output is used by both:

- Cloudflare Pages for the web app.
- Capacitor for the iOS app.

The app should support:

- Login.
- Invite-based registration.
- Consent capture.
- Patient daily check-ins.
- Support worker or doctor review workflows.

## Invite-Only Beta Goal

The next product milestone is an invite-only beta registration flow:

1. A doctor or support worker creates an invite.
2. The invite generates a code or link.
3. A patient opens the invite link.
4. The patient registers from that invite.
5. The patient is assigned to the correct care team.
6. Consent is captured before clinical tracking starts.
7. The patient can use the web app or iPhone app with the same account.

Public patient registration should stay disabled or restricted until invite-only registration is working.

## Beta Safety Checklist

Before inviting testers:

- Confirm demo credentials are hidden in production.
- Confirm registration is invite-only.
- Confirm consent is required before collecting clinical data.
- Confirm patients can only access their own data.
- Confirm doctors and support workers can only access assigned patients.
- Confirm audit logging is active.
- Confirm password reset and account recovery plans are defined.
- Confirm privacy policy, terms, and consent wording are ready.
- Confirm no real patient data is used during early technical testing.

## Developer Commands

Build the frontend:

```zsh
npm run build:client
```

Deploy the backend Worker:

```zsh
npx wrangler deploy
```

Deploy the web app:

```zsh
npx wrangler pages deploy dist/client --project-name=<pages-project-name>
```

Sync the iOS app:

```zsh
npm run mobile:sync:ios
```

Open the iOS project:

```zsh
npm run mobile:open:ios
```

Run local frontend development:

```zsh
npm run dev:client
```

## Private Notes

Keep private operational notes outside GitHub, including:

- Cloudflare account credentials.
- Apple Developer credentials.
- JWT secrets.
- Password hashing peppers or salts.
- Database IDs if treating them as private operational details.
- Recovery codes.
- Real user passwords.
- Real patient or clinical data.
