# Publish the client login

The CRM remains private per client. Sharing its URL does not expose the coach workspace or other clients' data. Accounts require their package's verified payment. There is no public self-registration or anonymous access to journals.

## Existing Render service

1. Confirm the latest GitHub commit is Live in Render. Use Manual Deploy → Deploy latest commit if automatic deploy is disabled.
2. Open the service URL. A locked setup page is not ready for client access. Preserve existing credentials, encryption key and owner account; do not reset the database for deployment.
3. Sign in as coach → Admin → Run Live Check. This checks that running deployment's storage, all three package agreements, email setup, recorded test-email receipt, payment-link configuration, app origin, timezone display and build reference.

The health endpoint returns HTTP 503 if storage is missing or disconnected. A successful health check alone does not verify client journeys or inbox delivery.

## Service Agreements

The owner supplied final Canada, India Guided and India Self-Guided content. On the next production deployment, a one-time migration installs these reviewed defaults and preserves prior catalogue versions. Products & Services remains the place to edit future offers, descriptions, agreements and What Happens Next emails. Previously issued/signed records retain their agreed content.

Invoices, agreements and receipts now use the owner's supplied PDF pattern. The original coach signature is included in agreements. Client acknowledgements are recorded separately; they are not generated from the coach signature. Native date controls expose a Calendar button for choosing issue, due and coach-agreement dates.

## Email delivery test

Admin → Test Email Delivery → Send Test Email To My Gmail. This sends only to seekbyritu@gmail.com, with a unique reference and no client information or payment demand. It can be tested before final client terms are approved.

Check Inbox and Spam for that exact reference, then click I Received This Test Email. The CRM records provider acceptance separately from the coach's inbox confirmation. An interrupted response is Unknown, not Sent; check Gmail Sent before another attempt. Client emails still require reviewed business terms. No live message was sent by the coding workspace.

## Payments

Current owner-approved defaults: Canada CAD 150 deposit and CAD 350 balance by Interac e-Transfer to seekbyritu@gmail.com. India Guided CAD 100 and India Self-Guided CAD 50 use their supplied Stripe links. The earlier Canada Stripe links remain available for explicit custom use; they are not the default Canada payment instructions.

First-step emails attach the relevant Service Agreement and invoice, and include product-specific What Happens Next instructions. Plan preparation is 3–5 business days; Canada plan review is 15 minutes, followed by the separate CAD 350 request after approval. Payment verification remains manual. Payment Links do not install webhooks. No real charge was made during testing.

New references are alphabetical and random (IC-CA / IC-IG / IC-IS, or SBR for another offer). Existing issued numbers are unchanged. Invoices are payment requests; receipts require separately verified payments.

## Optional branded URL

The Render hostname does not lose `demo` automatically. The existing protected Render URL can be used while a branded address is being configured.

For crm.seekbyritu.com: add it in Render → Settings → Custom Domains, then create the crm CNAME in GoDaddy using Render's exact target. Leave the main website's DNS unchanged. After verification, update APP_ORIGIN to https://crm.seekbyritu.com and add that origin plus https://crm.seekbyritu.com/api/gmail/callback to the Google OAuth web client. Deploy and recheck login, Gmail and inbox delivery before changing the website CRM link.

## Verification evidence

The launch fixes pass 50 local tests, covering authentication/MFA, client isolation, private onboarding, package entitlements, invoices/receipts, payment-link mappings, draft approval, inbox-verification state and responsive coach/client browser journeys. Provider responses in tests are simulated; they do not prove actual Gmail delivery or Stripe checkout configuration.

The owner previously confirmed live encrypted storage on build 02c706c6f971. That result does not verify subsequent deployments. This workspace has no configured Render/GoDaddy credentials and its current outbound policy excludes the Render host. Production deployment and DNS changes cannot be independently performed or verified here. GitHub publication is separate from a live Render deployment.
