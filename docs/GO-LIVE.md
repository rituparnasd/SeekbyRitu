# Publish the client login

The CRM remains private per client. Sharing its URL does not expose the coach workspace or other clients' data. Accounts require their package's verified payment. There is no public self-registration or anonymous access to journals.

## Existing Render service

1. Open Render → `seek-by-ritu-demo` → Manual Deploy → Deploy latest commit (if automatic deploy has not already started).
2. Wait for the deployment to say Live, open the service URL and confirm that it shows the sign-in page. A locked setup page is not ready for client access.
3. Sign in as coach → Admin → Run Live Check. Check storage, build reference, package terms and email connection. This diagnostic sends no messages and does not verify actual inbox delivery.

The service health endpoint now returns HTTP 503 if storage is missing or disconnected. Existing credentials and the encryption key must be preserved; do not reset the owner or database for deployment.

## Branded URL

The existing hostname does not lose `demo` automatically. To use `crm.seekbyritu.com`, add that hostname in Render → Settings → Custom Domains and configure the `crm` CNAME in GoDaddy using the exact DNS target Render supplies. Leave the main `seekbyritu.com` website records unchanged.

After domain verification, update `APP_ORIGIN` to `https://crm.seekbyritu.com`. Add that origin and `https://crm.seekbyritu.com/api/gmail/callback` in the Google OAuth web client configuration. Deploy again and verify sign-in, Gmail connection and a real test email before switching the website's CRM link.

## Payments and enrolment emails

Stripe is the selected payment method, but no actual payment links have been supplied yet. Required amounts are CAD 50 (Self-Guided), CAD 100 (Guided), CAD 150 (Premium deposit) and CAD 350 (Premium balance). Add the correct links to the corresponding reviewed invoice/payment instructions; do not substitute the Gmail sender address for a payment destination.

Final reviewed package terms and payment instructions are still required before sending enrolment emails. Existing Gmail configuration is not proof of actual inbox delivery. No live email or payment has been sent from this workspace.

## Verification status

The signature-free release passed 33 local tests. This workspace has neither a bound Render API key/deploy hook nor network access to the Render host. Public `/health` verification was denied by the outbound proxy before reaching Render. GitHub publication is verified separately from production deployment; do not interpret the local test result as a verified live deployment.

### Stripe Payment Links (3 November 2026)

The four owner-provided public checkout links are configured in `public/payment-links.js`: Self-Guided CAD 50, Guided Coaching CAD 100, Premium deposit CAD 150, and Premium balance CAD 350. Programme payment-request emails and new invoice PDFs use the matching link. Billing drafts select a link only for a single matching CAD package instalment; changing the price, discount, quantity or tax requires matching payment instructions. Existing issued documents remain unchanged.

These links do not verify payments automatically. Verify the payment in Stripe before confirming the corresponding payment in the client record. No Stripe webhook is configured by this change. Checkout amounts and actual inbox delivery still require live verification. Final programme terms must be completed and approved before enrolment emails can be sent.

Validation: syntax checks and all 34 tests passed, including exact checkout-link mapping, customised invoice mismatch rejection, package workflows and browser journeys. No actual payment or enrolment email was sent during testing.
