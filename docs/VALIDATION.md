# Validation and remaining release checks

Automated checks use isolated temporary SQLite databases and local Chromium; they do not seed the deployed application.

- Owner setup, mandatory MFA, recovery-code generation and authenticated sessions.
- No clients on first login; new leads persist across reloads.
- CSRF/origin enforcement, one-use invitations and session logout.
- Client cannot retrieve another client's journal, coach notes or unreleased material; client cannot self-approve coach-reviewed resource completion.
- Invoice/agreement PDF response and encrypted backup output.
- Wrong-key and nonempty-database restore rejection; successful encrypted record restore.
- Report coverage/denominators and completed/adapted/rest separation.
- Server-side questionnaire-to-plan deadline and idempotent event messages.
- Compact browser layouts at 375, 390 and 430px without horizontal overflow.

Not verified: real Render/PostgreSQL TLS connectivity, actual email deliverability/attachments, physical iPhone Safari, production backup recovery, large-workspace load/concurrency, final agreement enforceability, taxes, bank verification and third-party e-sign identity. No production-ready/security-certification claim is made.
