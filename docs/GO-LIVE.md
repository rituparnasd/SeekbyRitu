# Publish the client login

The CRM remains private per client. Sharing its URL does not expose the coach workspace or other clients' data. Accounts require their package's verified payment. There is no public self-registration or anonymous access to journals.

## Existing Render service

1. Confirm the latest GitHub commit is Live in Render. Use Manual Deploy → Deploy latest commit if automatic deploy is disabled.
2. Open the service URL. A locked setup page is not ready for client access. Preserve existing credentials, encryption key and owner account; do not reset the database for deployment.
3. Sign in as coach → Admin → Run Live Check. This checks that running deployment's storage, all three package agreements, email setup, recorded test-email receipt, payment-link configuration, app origin, timezone display and build reference.

The health endpoint returns HTTP 503 if storage is missing or disconnected. A successful health check alone does not verify client journeys or inbox delivery.

## Service Agreements

Products & Services → Edit Defaults for each package → complete and review its Service Agreement → Save Defaults with approval checked. Draft markers such as “must be agreed before signing” block approval and issuing. There is no automatic approval of unresolved financial or privacy terms.

See [Final business review](LAUNCH-DECISIONS.md) for the remaining business decisions and proposed wording. The confirmed Premium threshold is 95%, with eligible deposit return within five business days. Existing issued documents retain their snapshots; issue a revision rather than silently altering a signed document.

## Email delivery test

Admin → Test Email Delivery → Send Test Email To My Gmail. This sends only to seekbyritu@gmail.com, with a unique reference and no client information or payment demand. It can be tested before final client terms are approved.

Check Inbox and Spam for that exact reference, then click I Received This Test Email. The CRM records provider acceptance separately from the coach's inbox confirmation. An interrupted response is Unknown, not Sent; check Gmail Sent before another attempt. Client emails still require reviewed business terms. No live message was sent by the coding workspace.

## Payments

The four owner-provided checkout links are configured in `public/payment-links.js`: Self-Guided CAD 50, Guided Coaching CAD 100, Premium deposit CAD 150 and Premium balance CAD 350. Programme payment-request emails and new invoices use the matching link. Billing drafts select links only for a single matching CAD package instalment. A changed price, quantity, discount or tax requires matching payment instructions. There is no CAD 500 checkout link, so the CAD 150 link is never used for a CAD 500 invoice.

Open each Stripe checkout page and verify its product, CAD currency and amount before sharing it. Confirm payments in Stripe before recording the matching client payment in the CRM. Payment Links do not install webhooks or automatically verify payments. No real charge was made during testing.

## Optional branded URL

The Render hostname does not lose `demo` automatically. The existing protected Render URL can be used while a branded address is being configured.

For crm.seekbyritu.com: add it in Render → Settings → Custom Domains, then create the crm CNAME in GoDaddy using Render's exact target. Leave the main website's DNS unchanged. After verification, update APP_ORIGIN to https://crm.seekbyritu.com and add that origin plus https://crm.seekbyritu.com/api/gmail/callback to the Google OAuth web client. Deploy and recheck login, Gmail and inbox delivery before changing the website CRM link.

## Verification evidence

The launch fixes pass 37 local tests, covering authentication/MFA, client isolation, private onboarding, package entitlements, invoices/receipts, payment-link mappings, draft approval, inbox-verification state and responsive coach/client browser journeys. Provider responses in tests are simulated; they do not prove actual Gmail delivery or Stripe checkout configuration.

The owner previously confirmed live encrypted storage on build 02c706c6f971. That result does not verify subsequent deployments. This workspace has no configured Render/GoDaddy credentials and its current outbound policy excludes the Render host. Production deployment and DNS changes cannot be independently performed or verified here. GitHub publication is separate from a live Render deployment.
