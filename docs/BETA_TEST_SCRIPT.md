# L.A.M.B. Website Beta Test Script

Last updated: 2026-05-25

Use fake accounts and fake clinical data unless privacy, consent, support coverage, and clinical oversight are formally ready.

## Session Setup

- Tester role:
- Device:
- Browser:
- Network:
- Date/time:
- Observer:

## Patient Flow

1. Open the invite link.
2. Activate account and set password.
3. Log in.
4. Read and accept required consent.
5. Create a mood check-in.
6. Change "When did this happen?" to an earlier time.
7. Add missed medication details using "Missed some" or "Missed all."
8. Save a morning report.
9. Save a night report.
10. Complete the weekly safety screen.
11. Open history and confirm saved entries are understandable.

Pass criteria:

- Tester can finish without help.
- Safety/consent language is understandable.
- Mood, medication, sleep, and weekly screen entries save.
- Earlier emotion time appears as intended.

## Support Worker Flow

1. Log in as support worker.
2. Find assigned patient by name.
3. Review patient queue.
4. Open mood timeline.
5. Confirm missed medication badge is visible.
6. Confirm "felt at" and "recorded at" emotion timing is understandable.
7. Add an observation.
8. Trigger or review a critical alert from fake data.
9. Dismiss alert for later and confirm popup does not loop.
10. Acknowledge alert and confirm ownership appears.

Pass criteria:

- Patient name is easy to find.
- Critical alert ownership is clear.
- Alert popup does not repeat after view/dismiss.
- Support worker knows what needs follow-up.

## Doctor/Admin Flow

1. Log in as app admin.
2. Create a staff account.
3. Create a patient invite.
4. Review account list.
5. Review pending invites.
6. Review critical alert audit.
7. Confirm who viewed, dismissed, opened, or acknowledged alerts.

Pass criteria:

- Admin can create accounts without developer help.
- Audit history is understandable.
- No credentials or real private information are exposed.

## Feedback Questions

- What was confusing?
- What felt useful?
- What felt too clinical, too intense, or too much?
- What would you expect to happen after a critical alert?
- Would this help a support worker or doctor understand the week between appointments?
- What would stop you from using it daily?

## Bug Log

| Time | Role | Page | Issue | Severity | Screenshot? | Fixed? |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

