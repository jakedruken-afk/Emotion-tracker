# L.A.M.B Mobile Readiness Checklist

Use this checklist as the gate before moving from the web beta to iOS and Android mobile beta
testing. The default path is to keep the website beta active, build mobile as a private internal
track first, and use TestFlight or Google Play internal testing only after the app passes the
technical, safety, privacy, and workflow checks below.

Reference links:

- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
- Apple TestFlight overview: https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/
- Google Play Data Safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Google Play testing tracks: https://support.google.com/googleplay/android-developer/answer/9845334
- Health Canada software as a medical device guidance: https://www.canada.ca/en/health-canada/services/drugs-health-products/medical-devices/application-information/guidance-documents/software-medical-device-guidance-document.html

## Product And Safety Gates

- [ ] Mobile app clearly says L.A.M.B is not 24/7 emergency monitoring.
- [ ] Consent appears before tracking starts.
- [ ] Patient can understand who sees their data: doctor, support worker, and beta admin.
- [ ] Critical alerts have a visible acknowledgement and audit flow.
- [ ] Support worker or doctor can see why a patient is high priority.
- [ ] Emergency/code-word idea is documented but not launched until escalation rules are approved.
- [ ] Beta uses fake data or low-risk supervised testers until privacy and safety workflows are reviewed.

## Technical Build Gates

- [x] `npm run check` passes.
- [x] `npm run build:client` passes.
- [x] `npm run mobile:sync:ios` works.
- [x] `npm run mobile:sync:android` works.
- [ ] iOS app launches in Simulator.
- [ ] iOS app launches on a real iPhone when available.
- [ ] Android app launches in an emulator.
- [ ] Android app launches on a real Android device when available.
- [x] App points to the production web/API domain, not `localhost`.
- [x] Production mobile build disables dev-only settings such as cleartext HTTP and WebView debugging.
- [ ] App icons, splash screen, name, bundle/package ID, and version numbers are correct.
- [x] No secrets, API keys, admin passwords, private credentials, or real patient data are bundled into the app.

## Mobile UX Test Gates

- [ ] Login fits properly on small iPhones.
- [ ] Invite link opens cleanly on mobile.
- [ ] Patient registration from invite works.
- [ ] Consent flow works.
- [ ] Mood log can be submitted more than once without logout.
- [ ] Mood log supports recording an emotion from earlier in the day.
- [ ] Missed medication details appear for "Missed some" and "Missed all".
- [ ] Morning report works.
- [ ] Night report works and has no text encoding bugs such as `&apos;`.
- [ ] Weekly screening works.
- [ ] Offline draft/save queue works.
- [ ] App recovers when switching from Wi-Fi to LTE.
- [ ] Critical alert appears once, then respects acknowledgement or later handling.

## iOS Readiness

- [ ] Apple Developer account is active.
- [x] Bundle ID is confirmed as `com.lambpilot.app`.
- [ ] Signing team and provisioning profile are configured.
- [ ] TestFlight internal testing is used before external testing.
- [ ] App Privacy labels are prepared for health data, contact info, location, identifiers, diagnostics, and usage data where applicable.
- [ ] Privacy policy URL and support URL are ready.
- [x] Location permission text is accurate if GPS snapshot remains enabled.
- [ ] Screenshots are prepared for required device sizes.

## Android Readiness

- [ ] Google Play Console account is ready.
- [x] Android package ID matches the production app identity.
- [ ] Release signing key/keystore is created and backed up securely.
- [ ] Internal or closed testing track is used before production.
- [ ] Google Play Data Safety form is prepared.
- [x] Android permissions are minimized, especially location.
- [ ] App works on at least one small phone, one standard phone, and one older supported Android version.

## Privacy, Compliance, And Clinical Review

- [ ] Confirm Canadian data residency and Cloudflare D1 region strategy.
- [ ] Confirm encryption in transit and at rest.
- [ ] Confirm audit logs cover login, patient access, alert acknowledgement, edits, and admin actions.
- [ ] Review PIPEDA, PHIA, and PHIPA obligations with the correct jurisdictional advisor.
- [ ] Review Health Canada SaMD classification before marketing L.A.M.B as diagnostic or treatment software.
- [ ] Create plain-language beta consent and privacy notes for testers.
- [ ] Document who responds to alerts, during what hours, and what happens after acknowledgement.

## Final Go/No-Go Test

- [ ] Admin creates doctor account.
- [ ] Admin creates support worker account.
- [ ] Doctor or support worker creates patient invite.
- [ ] Patient registers from invite on phone.
- [ ] Patient submits mood, missed meds, daily report, night report, and weekly screening.
- [ ] Support worker sees patient name, priority reason, reports, medication details, and alerts.
- [ ] Doctor sees the same patient information.
- [ ] Admin can view account status and alert acknowledgement history.
- [ ] Test passes on LTE and on Wi-Fi.
- [ ] No blocker bugs remain before inviting real mobile testers.

## Defaults For The First Mobile Beta

- Web beta stays the main testing surface for now.
- Mobile beta starts patient-first; support and doctor mobile polish can follow after patient flows are stable.
- Use the existing Capacitor app instead of rebuilding native iOS and Android apps from scratch.
- Push notifications stay out of the first mobile beta unless escalation policy, privacy wording, and consent are ready.

## Execution Notes

Last executed: 2026-05-27.

- TypeScript check, triage regression, clinical regression, and client production build passed.
- iOS and Android Capacitor sync passed using the local Capacitor CLI.
- Native release-hardening was applied for cleartext traffic, Android WebView debugging, and app backup.
- iOS and Android location permission text/permissions were added for the optional GPS snapshot feature.
- Built web/native assets were scanned for obvious secret, token, private-note, and real database ID strings.
- Manual gates still remain for simulator/device launch, Apple Developer signing, TestFlight, Google Play Console, store privacy forms, and real LTE/Wi-Fi testing.
