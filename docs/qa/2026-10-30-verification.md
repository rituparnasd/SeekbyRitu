# CRM verification — 30 October 2026

This report separates local verification from production readiness. All test databases, users and browser sessions were disposable fixtures. No production records were modified and no real email or payment was sent.

Final validation: `npm run check` passed; `npm test` completed with 22 passed, 0 failed, 0 skipped.

## Verified locally

- Owner setup, mandatory coach MFA and recovery code use; failed-login limits and cooldown behaviour.
- No client CRM invitation, password activation or authenticated access before the full deposit and balance are verified.
- Limited onboarding links: no session issued; invalid/expired tokens denied; cross-origin submissions denied; stale agreement versions denied; submitted answers cannot be overwritten.
- Real client browser account at phone width: habit and daily-practice updates survive reload; check-ins capture both; journals survive reload.
- Sequential resources: future content is not disclosed; a client's request cannot approve a coach-reviewed resource; the next resource opens after coach approval and its release day.
- Client isolation: coach notes, another client's records and unreleased resources are not exposed; billing/admin/backup actions are denied to clients.
- Desktop and responsive layout checks at 375, 390, 430, 700, 1024 and 1440 pixels in Chromium (individual tests cover different subsets). No physical iPhone/Safari claim is made.
- Catalogue variants, customised invoice/Service Agreement drafts, frozen issued versions, revisions, money/tax/discount calculations, partial receipts, duplicate-payment and overpayment rejection, optional agreements for products, and PDF generation.
- Every-third-day calls; ten calls per programme; conflicts with calls, walkthroughs and preparation blocks; real browser hold/resume and client pause display.
- Report coverage and edited-pillar grouping; weekly/day-30 PDF generation; encrypted backup restore rejects a wrong key and existing non-empty target.
- Verified TLS trust options tested against local trusted/untrusted/wrong-host certificates. TLS verification remains enabled.
- Gmail formatting, attachments, token refresh, accepted/rejected/uncertain provider responses tested with mocked transport. This is not a real inbox-delivery test.

## Issues found and fixed

1. Reports could group an edited habit under its former pillar. Reports now use the effective agreed habit definition.
2. Out-of-range habit IDs or unrecognised statuses could enter client-submitted records. The server now rejects them; API regression coverage verifies transaction rejection.
3. Coach/client screens could suggest an active programme when activation was still pending or blocked. The interface now shows the pending/paused state and does not offer daily submission forms there.
4. Resuming a legacy active programme without a persisted `calls` array could erase its generated call schedule. The original schedule is reconstructed before remaining calls are shifted. The real-client browser regression reproduces the legacy case and verifies restored calls.
5. Automatic activation previously checked other coaching calls but not walkthroughs or coach preparation blocks. Those conflicts now block activation too.

## Not verified or still outstanding

- The public Render `/health` request was blocked by the managed environment's outbound proxy (HTTP 403 on CONNECT), before reaching the application. This does not establish a Render outage.
- Production PostgreSQL connectivity, production backup restoration, deployed build state and production OAuth consent were not verified from this workspace.
- Actual Gmail inbox delivery, replies and attachment/link opening require a live permitted connection and reviewed final business terms. No real messages were sent.
- Payment receipt verification is deliberately manual; no bank or payment processor integration was tested or claimed.
- Calendar scheduling remains UTC. The agreement's Mountain Time wording still needs alignment before client scheduling is treated as launch-ready. Google Calendar synchronization is not connected.
- Final refund-return timing, cancellation/early-removal treatment, approved payment instructions and the referenced Privacy Policy remain business prerequisites. Tests cannot make those decisions.
- No high-volume production load test, physical-device Safari test or independent security audit was performed.
