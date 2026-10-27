# Seek by Ritu — interactive CRM demo

Mobile-friendly coaching workspace using the approved navy, forest green, sage and off-white visual direction. The SR wordmark is a text approximation; original vector brand assets are not bundled.

## Run

Requires Node.js 22 or later. No application dependencies or external services.

```sh
cd /workspace/SeekbyRitu
npm ci
npm run check
npm start
```

The server uses `PORT` (default 3000). `/health` returns JSON readiness.

## Explore

Use the top-right workspace switcher:

- **Ritu:** client queue, profiles, habit editor, daily records, journal review, resource library, reports, draft agreements and coach notes.
- **Daniel Brooks:** fictional British-Caribbean male designer; English workflow.
- **Meera Shah:** fictional Gujarati female community worker; Roman Hindi workflow.

Tick a habit or choose adapted/rest/missed, submit a check-in, then return to the coach view to inspect its timestamp and snapshot. Daily Journal and Learn & Apply are separate. Demo edits persist in this browser's localStorage. Print reports using the browser's Save as PDF; download recorded habit activity as CSV. Reports distinguish real demo submissions from illustrative sample self-ratings.

## Scope and privacy

**This is a UI/interaction demo, not a production CRM. Do not enter real client information.** The persona switcher is not authentication. Browser-local storage is not secure private account storage. All fictional records are available to anyone using this browser. Coach notes are hidden only by the interface, not an access-control boundary. Language switching covers core UI; exact translation of every string is not complete. The sample onboarding profile is not the full intake. Resources are demonstration exercises; assignment editing, evidence uploads, payments, reminder delivery, call scheduling, immutable plan history, automated report jobs and legally valid e-signatures are not implemented. The 95% threshold is a draft policy, not a refund decision engine.

A demo acknowledgement is explicitly not a binding contract. No client data is sent to an AI provider. There are no analytics, CDN scripts or third-party fonts. Security headers constrain scripts and framing, but they do not substitute for authentication, authorisation or operational security.

## Render: deploy the demonstration

1. Put these files in the GitHub repository; no files have been pushed automatically.
2. In Render, create a Blueprint from the repository using `render.yaml`, or a Node web service with build `npm ci` and start `npm start`.
3. Set health check to `/health`. Render supplies `PORT`. No secrets are required for this demo.
4. Deploy and check the health endpoint and both demo personas. Test mobile layouts, tracking, saved notes and print output.
5. Add a custom domain in Render, follow its DNS instructions, and verify HTTPS before putting the login/demo link on your website.
6. Keep the demo label visible. Sharing this service does not create secure client accounts.

## Required before real enrolment

Build a server-side authenticated application with a relational database. Define client ownership on every record, role checks on every endpoint and private object storage for evidence. Require coach MFA, secure HTTP-only session cookies, login rate limits, session revocation and recovery flows. Never use the demo persona selector as access control.

Choose database/storage regions and retention rules appropriate to the business/client jurisdictions. Configure TLS, encrypted managed storage, restricted credentials and managed secrets. Record access and administrative changes without logging journal content. Use signed, short-lived file/report downloads and verify permissions again when exporting.

Implement original intake submissions, versioned agreed plans, daily habit instances, separate timestamped check-ins and journal records, evidence review, resource assignments, call scheduling and report jobs. Store instants in UTC and schedule programme days in the client's timezone; this demo's date key uses UTC only. Reports must show coverage/missing data, agreed adaptations and explicit scoring denominators. Health and spiritual self-ratings are not clinical measurements.

Finalise programme currency, 95% eligibility definition, exceptions, repeat terms, deposit/refund rules and privacy terms with appropriate professional review. Integrate a signing provider with signed document retention and verification rather than treating a typed name as verified signing.

Test cross-client access denial, coach-only access, upload limits, export authorisation, backup restoration and account deletion before accepting real data. Add monitored scheduled jobs for weekly/day-30 reports and reminders. Conduct a security review and test the deployed environment before launch. High data volume also requires database indexes, pagination, storage quotas and bounded background jobs; localStorage is not the scaling architecture.

## Expanded personalised plans

Each fictional client now has 15 assignments (three per HRCMS pillar), with bilingual action, purpose, completion standard, chosen-block label and adaptation text. Existing first-five habit indices are retained so previously recorded ticks do not move to another pillar. Expanded habits and bilingual edits are stored separately from legacy demo edits. Language preference is saved per fictional client and can be changed in the header; check-in/journal draft fields survive that change. Personal identity affirmations and coach-agreed Simran are separate from habit completion. No sacred wording is invented or automatically assigned.

The supplied logo is visible in chat but the original image file has not been exposed in the execution workspace. The incorrect plain SR footer has been removed, with a temporary brand-name signature pending the actual asset. Do not describe this signature as the supplied logo. Long-form demo legal/report copy still requires complete localisation.
