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

Gmail transport unit tests cover MIME sender/reply headers, PDF attachments, header-injection rejection, token refresh, provider success/rejection and unknown delivery after interruption. OAuth URL/state/PKCE and client-role denial are checked locally. No actual Gmail was connected or message sent. A public Render health check from this workspace was blocked by the outbound CONNECT proxy (403), so it did not establish Render's live status.
