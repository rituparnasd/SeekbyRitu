# Seek by Ritu — server-backed coaching workspace

The original seeded demonstration clients were removed. A fresh database starts empty. Per the coach’s later request, this release adds **one explicitly marked fictional training client** on the first restart of an already configured owner workspace. A persisted migration marker prevents repeated creation. The coach can also use Clients → Create Test Client (idempotent). The old browser-local demo key is removed on loading the login screen; it is never imported into the live database. Temporary identities used in automated tests exist only in disposable test databases.

## Current capabilities

- Coach owner setup with password hashing, mandatory authenticator MFA and single-use recovery codes.
- Client accounts with expiring, single-use invitation/password-reset links; HttpOnly sessions, CSRF and origin checks, eight-hour session expiry and login throttling.
- Encrypted server records, server-enforced client isolation, coach-only private notes and unreleased-resource filtering.
- Leads, original 30-question intake, agreed profiles, manually assigned habits/practices, check-ins, separate journals with dated history and internal scheduling.
- Event-generated coach tasks, plan deadlines and email queue; server-side event reconciliation works without a coach browser open.
- Daily resource gating, optional coach approval, weekly/day-30 report generation, PDF invoices/receipts/one-page agreement and encrypted backup export/restore.
- Gmail OAuth sending from/replies to seekbyritu@gmail.com, with PDF attachments. Tokens are encrypted; no Gmail password is stored. No mail is sent until Google consent and final business settings are configured.

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

### Gmail and document settings

The confirmed sender and reply address is **seekbyritu@gmail.com**. A paid domain email address is not required. Website/domain remain at **seekbyritu.com**, with domain DNS at GoDaddy and the website hosted on Emergent; this change does not move the website or modify DNS.

1. In Google Cloud, enable the Gmail API and configure OAuth consent for the business.
2. Create an OAuth **Web Application** client. Its authorised redirect URI must be the exact `APP_ORIGIN` followed by `/api/gmail/callback` (for the current Render URL: `https://seek-by-ritu-demo.onrender.com/api/gmail/callback`).
3. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` directly in Render's secure Environment settings. Do not put the secret in GitHub or chat. Set `EMAIL_PROVIDER=gmail` (the default).
4. If Google consent is in Testing, add seekbyritu@gmail.com as a test user. Testing refresh tokens can expire; use the appropriate production consent/verification process before relying on unattended live sending. Google may require a privacy policy, domain verification and app verification for the chosen scope.
5. Sign into the CRM as coach → **Email Center → Connect / Reconnect Gmail**, then approve Google access while signed into seekbyritu@gmail.com. Other Google accounts are rejected. OAuth uses single-use expiring state and PKCE.
6. Send a controlled test to an address you own; verify sender/reply address, receipt/agreement attachments and inbox delivery before enabling automation.

The app requests only OpenID/email identity and Gmail send scope, not inbox-reading access. It does not receive the Gmail password. Refresh/access tokens are encrypted in the database. Disconnect removes the local connection; Google account permissions can also be revoked through Google security settings.

- `BUSINESS_LEGAL_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_CURRENCY`: optional overrides for the confirmed defaults: Rituparna Das / BLINDSPOT STUDIOS, Unit 706, 342 15 Avenue SW, Calgary, AB T2R 0P9, Canada; CAD. Registration: TN28592426.
- `PAYMENT_INSTRUCTIONS`: approved payment route; never invent bank/account details.
- `FINAL_PROGRAMME_TERMS`: reviewed agreement text, at most 3,200 characters. Finalise refund/cancellation, 95% eligibility, adaptations, emergencies, repeat process and privacy/access terms before collecting payment.
- `MAIL_AUTOMATION=true`: opt in to background sending of due drafts; default is manual review/send.

First-steps messages attach the agreement; verified payment confirmations attach receipts. Balance requests attach invoice PDFs. Gmail acceptance is not proof of inbox delivery or reading. Gmail does not provide an exactly-once sending guarantee: if a network interruption makes delivery uncertain, the app records **Unknown**, blocks blind retries and asks the coach to check Gmail Sent before manually resolving the status. Tests mock Gmail; live Google consent, refresh and delivery remain unverified without configured credentials.

Optional legacy Resend support requires `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and a verified domain `EMAIL_FROM`; it cannot send as @gmail.com.

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

The uploaded draft identifies Rituparna Das / BLINDSPOT STUDIOS, Alberta registration TN28592426, CAD and seekbyritu@gmail.com; runtime business name/currency defaults reflect those details. The postal address and Gmail sender/reply address have now been confirmed. Approved final terms and the Google OAuth connection remain required. Plan preparation now uses the confirmed **three business days**, counting from the day after submission and skipping Saturday/Sunday. Public holidays are not currently excluded. Existing manually revised deadlines are preserved. Programme start dates and every-third-day coaching calls still use calendar days.

### Database TLS troubleshooting

If setup shows `DATABASE_TLS`, the screen now also gives a safe `TLS Detail` such as `ERR_TLS_CERT_ALTNAME_INVALID` or `SELF_SIGNED_CERT_IN_CHAIN`. Share only those codes, not the connection URL. Do not change the encryption key or disable verification.

`DATABASE_CA_CERT` can supply an additional **provider-issued CA certificate** in PEM format when required by the provider. Obtain it through the provider's authenticated dashboard/official support or verified official documentation. Do not trust a certificate copied from an unverified handshake, a random download, or a private key. The app retains public roots, verifies certificate validity/hostname and rejects malformed/non-CA input. This is optional trust configuration, not a verification bypass. Live Render certificate requirements remain unverified until the exact TLS detail is known.

## Training client and account preview

Aarav Mehta (Test) is a fictional Day-8 profile with 15 example habits, four-window practices, sample intake/check-in/journal entries and daily resource examples. Coach workspace dropdown or View as Client opens a clearly labelled coach preview; it does not log the coach into a different authenticated account. The normal client invitation flow can be used separately for testing actual client-role login. Test email addresses use the reserved `example.invalid` domain. Server-side sending is blocked for test clients, no enrollment messages are queued, coaching calls are empty and sample financial PDFs are labelled fictional. The profile does not change any real client, login or encryption settings.

The `onrender.com` hostname is only the current public address. A custom subdomain such as `crm.seekbyritu.com` can be added in Render Custom Domains, followed by the exact CNAME Render specifies in GoDaddy DNS and HTTPS verification. Keep the main website hosted on Emergent. Update `APP_ORIGIN` and the Google OAuth redirect URI together when changing the CRM hostname; verify login and Gmail afterwards. Code and PostgreSQL data can also be migrated to another compatible hosting provider, with a tested backup/restore and secure configuration.

### Products & Services and Billing

Coach-only **Products & Services** stores offers, prices, currency, tax rates and default Service Agreement templates. Create variants or archive offers without changing existing customer documents. The initial Inner Code offer is a draft; review its terms before using it.

**Billing** supports existing CRM clients or manually entered customers, multiple items, per-line discounts and tax, and client-specific invoice descriptions, payment schedules and agreement terms. Inner Code has deposit/balance amount presets. These presets do not verify a payment or activate coaching. The existing enrollment payment verification flow remains authoritative for account activation.

Save a draft, preview both PDFs, then issue reviewed documents. Issued records receive a unique reference and freeze their customer, business, offer, price and terms snapshots. Corrections create a linked draft revision; prior records remain intact. Numbers and calculations are authoritative on the server, and stale edits are rejected. Signed copies can be retained externally; this generator does not add a separate identity-verified electronic signing service.

**Prepare Email** adds a manually sent message to Email Center with the invoice and Service Agreement PDF attachments. It never sends automatically, even when `MAIL_AUTOMATION=true`. Delivery uses the existing configured provider; uncertain deliveries require review in Gmail Sent. Fictional test customers cannot receive live mail. Product-specific terms must be reviewed for each customer; existing programme enrollment terms are not silently replaced by catalogue edits.

Catalogue and billing records use encrypted `documents` rows, are excluded from client state and are included in the existing encrypted backup export. No additional Render environment variables are needed. Tax rates must be entered explicitly; a default 0% does not establish exemption.
