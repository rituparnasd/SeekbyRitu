# Seek by Ritu — server-backed coaching workspace

The seeded demonstration clients have been removed. A new database starts with **zero clients, habits, journals or resource assignments**. The old browser-local demo key is removed on loading the login screen; it is never imported into the live database. Temporary identities used in automated tests exist only in disposable test databases.

## Current capabilities

- Coach owner setup with password hashing, mandatory authenticator MFA and single-use recovery codes.
- Client accounts with expiring, single-use invitation/password-reset links; HttpOnly sessions, CSRF and origin checks, eight-hour session expiry and login throttling.
- Encrypted server records, server-enforced client isolation, coach-only private notes and unreleased-resource filtering.
- Leads, original 30-question intake, agreed profiles, manually assigned habits/practices, check-ins, separate journals with dated history and internal scheduling.
- Event-generated coach tasks, plan deadlines and email queue; server-side event reconciliation works without a coach browser open.
- Daily resource gating, optional coach approval, weekly/day-30 report generation, PDF invoices/receipts/one-page agreement and encrypted backup export/restore.
- Optional Resend sending with event idempotency keys and PDF attachments. No mail is sent until credentials, verified sender and final business settings are configured.

This is an initial server-backed implementation, **not a completed security certification or production launch approval**. Real PostgreSQL/Render deployment, deliverability, legal terms and scale/load verification remain outstanding. The original logo was extracted losslessly, including its original transparency, from the supplied draft PDF. It is bundled in the app and document templates; no substitute monogram is used.

## Before deploying on Render

The existing Render service name is intentionally retained in `render.yaml`; no additional paid database is provisioned automatically.

1. Create or select a managed PostgreSQL database. Check its price, region, backup policy and retention before purchasing. Keep the database and application in a suitable region for your clients. The app verifies database TLS certificates; do not disable verification.
2. In Render → existing service → Environment, set the four required values below. Do not paste secret values into chat or commit them.
3. Deploy the latest GitHub commit. Without valid storage/security settings, the app stays locked at **Server Setup Required**. `/health` reports `ready: false` rather than claiming application readiness.
4. Open the service over HTTPS. Create the owner once using the setup token, email and a password of at least 14 characters.
5. Add the displayed secret to an authenticator app. Save the single-use recovery codes offline. Sign in using password plus authenticator/recovery code. The bootstrap token cannot create another owner after setup.
6. Configure business/sender settings, test delivery to an address you control, verify PDFs and complete deployment/access/restore checks before enrolling real clients.

### Required secure environment settings

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Managed PostgreSQL connection URL, with trusted TLS certificates |
| `APP_ORIGIN` | Exact HTTPS site origin, e.g. `https://your-service.onrender.com`, no trailing slash |
| `DATA_ENCRYPTION_KEY` | Base64 encoding of 32 random bytes |
| `OWNER_SETUP_TOKEN` | At least 32 characters of cryptographically random secret |

Generate secrets in a trusted terminal/password manager, for example `openssl rand -base64 32` for the encryption key and `openssl rand -hex 32` for the owner token. Store them directly in secure environment settings and keep protected recovery copies. **Changing or losing the encryption key makes existing data unreadable.** Key rotation needs a deliberate migration; do not regenerate it on each deploy.

### Email and document settings

- `RESEND_API_KEY`: secret API key entered only in secure environment settings.
- `EMAIL_FROM`: provider-verified sender on a domain you control.
- `BUSINESS_LEGAL_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_CURRENCY`: approved business details.
- `PAYMENT_INSTRUCTIONS`: approved payment route; never invent account details.
- `FINAL_PROGRAMME_TERMS`: reviewed agreement text, at most 3,200 characters to fit the one-page layout. Include currency, refund/cancellation rules, 95% eligibility definition, approved adaptations, emergencies, repeat process and privacy/access terms. Do not use an unreviewed draft to take payment.
- `MAIL_AUTOMATION=true`: opt in to background sending of due Draft messages. Default is manual review/send in Email Center.

Emails go through `api.resend.com` with TLS verification. First-steps emails attach the agreement; deposit/balance confirmations attach receipts and include secure setup links when needed. Balance requests attach invoice PDFs. A provider-accepted response records Sent; it is not proof the recipient read the email or that it avoided spam. Bank payments are **manually verified by the coach**; no bank/processor integration exists.

Account-authenticated agreement acknowledgement stores the exact text/version and timestamp. It is not third-party identity-verified e-signing and does not guarantee legal enforceability. Final professional review is still required. Draft documents are labelled when details are missing; invoice tax treatment remains to be confirmed.

## Data and operations

All application records are encrypted with AES-256-GCM before database storage. Passwords use scrypt (N=131072, r=8, p=1); sessions and invitation tokens are stored as hashes. Owner MFA secrets and business data are encrypted. HTTPS and database TLS complement application encryption. Encryption does not replace access controls or operational security.

PostgreSQL transactions/advisory locking protect updates; record-level merge/conflict detection avoids silently overwriting another device's changed record. Private notes, other clients' records and future resource bodies are never delivered by the client state endpoint. Reports show missing coverage and distinguish completed/adapted/rest; they do not determine clinical improvement or refund eligibility. Plan history/versioned denominators still require coach review when assignments change.

The scheduler checks due email drafts and completed weekly/day-30 reports every minute while the service runs. A sleeping/free instance will not run jobs while asleep; use an appropriate always-on deployment or external scheduler before relying on timely reminders. Times are currently UTC; client-local timezone scheduling and Google Calendar sync are not implemented.

The UI still loads aggregate workspace state. Records are stored separately and journal history is paginated, but high-volume pagination/load testing and retention/deletion workflows are not complete. Do not claim support for unlimited client/journal volume. File-evidence storage, payment processing, calendar-provider sync and independent security review remain separate work.

### Backup and restore

Coach → Today’s Work → **Download Encrypted Backup** exports encrypted records, accounts, report metadata and document records. Sessions/invitation links are excluded. Keep the encryption key separately. Configure managed database backups as well; the app does not silently provision a backup service.

Restore only into a new empty database:

```sh
node scripts/restore.mjs /secure/path/seek-encrypted-backup.json
```

Use the original encryption key and the destination `DATABASE_URL`. Wrong-key and nonempty-database restores are rejected. The backup restoration algorithm is tested locally; an actual managed PostgreSQL disaster-recovery drill remains required.

## Validation

```sh
npm ci
npm run check
npm test
```

Tests create isolated temporary databases and delete them afterward. Browser tests require Chromium at `/usr/bin/chromium` or `CHROMIUM_PATH`; no real email/payment services are contacted. Coverage includes owner MFA, invitation reuse rejection, CSRF, client isolation, private/future-content denial, document access, encrypted export/restore, reports, server workflow and the empty mobile/desktop workspace.

Local SQLite is allowed **only** under `NODE_ENV=test` with `TEST_DB_PATH`; production requires PostgreSQL. No production credentials or seeded client data are bundled.

## Redesigned draft documents

`docs/templates/Inner-Code-Agreement-and-Payment-Pack-DRAFT.pdf` contains the one-page agreement, deposit request, balance invoice and receipt template. Individual PDFs are supplied beside it. Regenerate with `node scripts/design-documents.mjs`. Fonts are embedded with their licence notices. Documents preserve the supplied draft’s open legal/payment items; they are not approved for sending or signing.

The uploaded draft identifies Rituparna Das / BLINDSPOT STUDIOS, Alberta registration TN28592426, CAD and seekbyritu@gmail.com; runtime business name/currency defaults reflect those details. Postal address, sender domain/address and approved final terms remain required. Plan preparation now uses the confirmed **three business days**, counting from the day after submission and skipping Saturday/Sunday. Public holidays are not currently excluded. Existing manually revised deadlines are preserved. Programme start dates and every-third-day coaching calls still use calendar days.
