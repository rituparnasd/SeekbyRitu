# Package documents and dual-zone scheduling — 2 November 2026

## Delivered

- Self-Guided CAD 50: 30 days, all five pillars, four daily check-ins, practices/journaling/resources, no private calls.
- Guided Coaching CAD 100: Self-Guided scope plus six 20-minute calls on Days 5/10/15/20/25/30.
- Premium Inner Code CAD 500: onboarding week/walkthrough plus 30 days, ten 20-minute calls every third day, CAD 150 included deposit and CAD 350 balance.
- Premium's final threshold is **95%**, superseding the user's briefly proposed 90%. Eligible deposit returns are within five business days. No deposit/refund threshold is attached to the two India packages.
- Package-specific payment gates, private questionnaire eligibility, plan-readiness activation and call counts; snapshots prevent silent changes to paid clients.
- Six reference-based sample PDFs: one-page invoice and two-page agreement for each package, plus a nine-page combined preview.
- Invoice amount due is distinct from total Premium programme price and later balance. PDFs exclude the private home address. Documents remain previews where cancellation, scoring or other terms still need agreement; no document is automatically approved.
- Calendar events, booking choices, preparation blocks and schedule emails show Calgary and India with dates. Time entries use Calgary; recurring wall time follows daylight-saving changes. Browser/server rules share the server's timezone database to prevent conflicting displays across devices.
- Existing UTC event instants and issued/acknowledged documents are preserved. Editing a future schedule intentionally applies the chosen Calgary wall time.
- Admin has an owner-only read-only Run Live Check for deployed database/encryption readiness, configuration, dual-zone clock and available Render build reference. It sends no email and processes no payment.

## Verification

`npm test`: 31 passed, 0 failed, 0 skipped, including actual CAD 50/100 invitation/login gates, 0/6/10 calls, DST folds/gaps, legacy UTC schedules, dual-zone browser rendering and client isolation. Additional final package/privacy checks passed. `npm run check` and `git diff --check` passed.

All six generated PDFs were checked for page counts, package amounts, signatures and absence of 90% wording; sample layouts were visually inspected. No real messages, payments or production records were created.

## Live limitation

The Render `/health` request was rejected by the workspace's outbound proxy (403 CONNECT), before reaching Render. A live deployment, production PostgreSQL and actual Gmail inbox delivery are **not verified** by these local results. Admin's check can be run after deployment, but does not prove full client journey or inbox delivery. Outstanding contractual details/payment instructions still require business approval before real enrolment emails.
