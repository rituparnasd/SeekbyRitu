# Final business review — not client-approved terms

Already confirmed by Ritu: three CAD packages (50 / 100 / 500); Premium split 150 + 350; 95% threshold; eligible deposit returned within five business days; plan preparation within three business days; Calgary and India appointment times; no coach signature image.

The following are proposed wording for Ritu to review. They are not silently added to signed agreements or marked approved. Once decided, update the matching templates in Products & Services and approve them there. Existing issued documents remain unchanged.

## Premium completion calculation

Proposed: completed agreed habit occurrences divided by applicable scheduled occurrences during the 30-day programme, multiplied by 100. Document agreed rest, pauses and adaptations in the personalised plan. Four daily check-ins are tracked separately. No unexcused call no-show is allowed for deposit eligibility. Final review determines eligibility; initiate an eligible CAD 150 refund within five business days after the final review. Payment-provider processing may take additional time.

Decision needed: whether this denominator is correct, and whether the refund clock begins at final review or programme completion. The CRM does not currently make or execute automatic refund decisions.

## Cancellation and early exit

Decide the treatment of each payment before and after questionnaire submission, plan delivery and programme activation, including coach cancellation and services not delivered. The Premium performance-deposit rule does not itself define cancellation refunds. No blanket non-refundable rule has been invented.

## Calls and loss of contact

Proposed from the supplied draft: normal rescheduling requires 24 hours' notice, once per call, with replacement within the programme period and available slots. Premium has three Emergency Cards and two Technical Cards, with any three usable overall. Coach-side issues do not consume cards or remove deposit eligibility. A validly excused call is not an unexcused no-show.

Proposed: follow up for three days after loss of contact before considering removal. Decide how unprovided services, payments and the deposit are treated on early removal. These rules must not remove applicable consumer rights.

## Privacy notice

Before enrolment, publish the actual privacy notice covering the business contact, purposes, collected information, access/correction/deletion requests, retention period, hosting/location and relevant service providers. The implementation uses Render/PostgreSQL for production storage, encrypted application records, Google OAuth/Gmail for email and Stripe-hosted links for checkout. The actual hosting region, retention policy and any further third-party processing must be confirmed from the live setup. No invented claim of certification or AI processing is included.

## Live steps that require the coach's accounts

1. Render: confirm the latest commit says Live; Admin → Run Live Check verifies that deployment's storage and package setup.
2. Email Center: send a test to seekbyritu@gmail.com, check Inbox/Spam for its reference, then confirm receipt in the CRM. Provider acceptance alone does not prove inbox placement.
3. Stripe: open each supplied checkout link and confirm CAD currency, product name and exact amount. Payment confirmation in the CRM remains manual; payment links alone do not install webhooks.
4. Optional branded address: add crm.seekbyritu.com in Render, configure its CNAME in GoDaddy, then update APP_ORIGIN and Google OAuth origin/callback. Keep the main website records unchanged. The current Render URL can be used before this optional domain change.
