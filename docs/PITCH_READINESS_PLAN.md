# L.A.M.B. Beta Polish And Pitch Readiness Plan

Last updated: 2026-05-25

This document is sanitized for GitHub. Do not add passwords, API keys, recovery codes, private account details, real patient information, or identifiable clinical notes.

## Product Positioning

L.A.M.B. is a private-pilot mental health and addictions support app for between-visit monitoring. It helps patients record mood, sleep, meals, medication adherence, weekly safety screens, and contextual notes. It helps doctors and support workers review patterns, spot missed medications or worsening risk signals, and document follow-up ownership.

L.A.M.B. should be pitched as a supervised care-team communication and pattern-review tool. It is not an emergency service, not a diagnosis tool, and not an autonomous treatment decision system.

## Pitch Claim Guardrails

- Say: "L.A.M.B. helps care teams see what happens between appointments."
- Say: "The beta focuses on invite-only use, consent capture, audit trails, and human review."
- Say: "Critical alerts are in-app workflow prompts that must be paired with a staffed escalation policy."
- Do not say: "L.A.M.B. prevents relapse or suicide."
- Do not say: "L.A.M.B. replaces clinicians, counsellors, crisis lines, or emergency services."
- Do not say: "L.A.M.B. is approved for clinical deployment."

## NL Health Alignment

Use these public priorities as pitch anchors:

- NL Health Services describes a goal of improving health outcomes through a more innovative, integrated, and sustainable health-care system.
- NL Health Services Research and Innovation describes a province-wide Living Lab approach where patients, staff, researchers, and partners collaborate to develop, test, and refine health-care solutions.
- Newfoundland and Labrador's PHIA framework emphasizes confidentiality, appropriate collection/use/disclosure, and balancing patient privacy with legitimate care-system needs.

Official sources:

- NL Health Services strategic plan: https://nlhealthservices.ca/overview/strategic-plan
- NL Health Services Research and Innovation: https://nlhealthservices.ca/research-and-innovation/?p=2668
- NL PHIA: https://www.gov.nl.ca/hcs/phia/
- Health Canada SaMD guidance: https://www.canada.ca/en/health-canada/services/drugs-health-products/medical-devices/application-information/guidance-documents/software-medical-device-guidance-document.html

## Beta Readiness Gates

Before inviting real beta users beyond close supervised testers:

- Account creation is invite-only and public registration stays closed.
- Consent is required before mood, sleep, GPS, or weekly safety data is collected.
- Demo credentials are hidden in production.
- Patients, support workers, doctors, and app admins can each complete their core workflow.
- Critical alerts show in support/doctor review and record who viewed, dismissed, opened, and acknowledged them.
- Missed medication details can be recorded for "Missed some" and "Missed all."
- Patients can record when an emotion happened earlier in the day.
- Admin can review accounts, invites, and critical-alert audit history.
- No real clinical data is used until privacy, consent, escalation, and support coverage are reviewed with an appropriate clinical/privacy advisor.

## Immediate Polish Backlog

Priority 1: Safety and Trust

- Write a short beta safety workflow: who monitors alerts, during what hours, what counts as urgent, and what happens if no one acknowledges an alert.
- Add clear "not 24/7 emergency monitoring" language anywhere a critical alert appears.
- Create a fake-patient demo mode for presentations, separate from real beta accounts.
- Add an admin-visible beta incident log for bugs, tester concerns, and safety events.

Priority 2: Web Beta Usability

- Test the full website on phone browser over LTE and hospital/guest Wi-Fi.
- Polish patient check-in spacing on small iPhone screens.
- Confirm the support dashboard highlights patient names, alert ownership, missed medications, and "felt at" emotion times.
- Add a simple "Send feedback" path or feedback instructions for beta testers.

Priority 3: Pitch Evidence

- Track pilot metrics weekly: active users, completed mood logs, daily reports, weekly screens, missed-medication entries, alert acknowledgement time, and usability issues.
- Save anonymized screenshots from fake data only.
- Maintain a running beta changelog with tester feedback and fixes.
- Prepare a one-page summary for clinicians and a separate one-page summary for health-system decision makers.

## Research To Conduct

Addictions counsellor discovery:

- Walk through a fake patient timeline.
- Ask which signals are clinically useful and which are noise.
- Ask what would make the support dashboard safer during real use.
- Ask what escalation workflow would be acceptable.
- Ask whether missed medication, sleep disruption, money changes, cravings, and substance use are framed correctly.

Patient/support-worker usability:

- Observe invite activation, first login, consent, first mood check-in, night report, missed-medication entry, and weekly screen.
- Note every place they hesitate, misunderstand text, or ask what to do next.
- Ask whether the app feels supportive, clinical, too heavy, or too confusing.

Buyer/partner discovery:

- Ask who would own this inside an organization.
- Ask what evidence is needed for a pilot.
- Ask what privacy/security review is required.
- Ask what integration expectations exist before a larger deployment.

Regulatory/privacy review:

- Confirm how NL PHIA applies to the intended beta workflow.
- Confirm whether PIPEDA or other private-sector privacy obligations apply.
- Confirm Health Canada SaMD positioning based on intended use before making clinical claims.

## Pitch Deck Skeleton

1. Problem: care teams often lack reliable between-visit context.
2. Product: invite-only patient, support-worker, doctor, and admin workflows.
3. Safety: consent, audit trails, critical-alert ownership, and emergency-use boundaries.
4. Beta proof: screenshots, tester quotes, usage metrics, and fix history.
5. NL fit: integrated care, innovation/living-lab testing, mental health/addictions workflows.
6. Ask: supervised pilot partner, clinical advisor, privacy/security review, and a small tester cohort.

## Next Build Candidates

- In-app beta feedback submission tied to user role and page.
- Admin beta issue tracker.
- De-identified pilot metrics export.
- Printable clinician one-pager generated from fake/demo data.
- Support-worker alert escalation notes: contacted patient, contacted support person, escalated to doctor, external emergency path advised.

