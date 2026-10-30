import PDFDocument from "pdfkit";
import {
  colours,
  pageHeader,
  documentTitle,
  clause,
  amountBand,
  draftNotice,
} from "./brand.mjs";
export const agreementText = (business) =>
  `SEEK BY RITU — PROGRAMME AGREEMENT (DRAFT)\n${business.name || "Business legal name pending"} | ${business.address || "Business address pending"}\nOne onboarding week followed by 30 coaching days across Health, Relationships, Career, Money and Spirituality. Includes personalised agreed commitments, four daily check-ins, separate journals, assigned resources and ten 20-minute coaching calls. A separate 30-minute walkthrough precedes programme activation.\nTotal: 500 ${business.currency || "CURRENCY PENDING"} (350 programme fee and 150 deposit). Balance is due before programme start. A verified balance payment schedules the following-day start subject to agreed scheduling.\nCoach and client agree actions, completion standards, client-chosen work blocks and adaptations. Coaching is not medical, psychological, legal or investment treatment. Clients should follow existing professional guidance and report limitations.\n95% is a proposed commitment threshold; its denominator, approved adaptations, emergency exceptions, repeat process, cancellation and deposit refund conditions MUST be finalised before accepting payment. No automatic forfeiture or medical success claim applies.\nPrivacy: coach access to submitted journals and intake must be disclosed and agreed. Access, retention, export/deletion and external processing terms require final approval.\nThis draft is not approved for enrolment. Electronic acknowledgement records the account, exact version and timestamp; it does not constitute third-party identity-verified signing. Applicable legal review is required.\nClient: __________________   Date: __________   Signature: __________________`;
export async function pdfDocument(record) {
  const { billingPDF } = await import("./billing.mjs");
  const { innerCodeTerms } = await import("./inner-code-terms.mjs");
  const date = record.date || new Date().toISOString().slice(0, 10),
    amount = Math.round(record.amount * 100);
  const value = {
    id: record.reference,
    reference: record.reference,
    invoiceReference: record.reference,
    version: 1,
    status: record.kind === "agreement" && !record.body ? "Draft" : "Issued",
    isTest: record.isTest,
    acknowledgement: record.acknowledgement,
    updatedAt: date,
    issuedAt: date,
    due: date,
    business: record.business,
    customer: { name: record.client, email: "" },
    currency: record.business.currency,
    items: [
      {
        name:
          record.kind === "agreement"
            ? "Inner Code"
            : "Inner Code — " + (record.amount === 350 ? "Balance" : "Deposit"),
        description: "Personalised coaching",
        quantity: 1,
        unit: amount,
        discount: 0,
        tax: 0,
        total: amount,
      },
    ],
    subtotal: amount,
    discount: 0,
    tax: 0,
    total: amount,
    payment:
      record.kind === "agreement"
        ? "CAD 500 total: CAD 150 deposit, then CAD 350 balance after the plan walkthrough."
        : record.kind === "receipt"
          ? "Payment verified by Rituparna."
          : record.body ||
            "Payment instructions will be provided by Rituparna.",
    terms: record.isTest ? innerCodeTerms : record.body || innerCodeTerms,
    receipt: {
      amount,
      date,
      method: record.paymentDetails?.method || "Coach-verified payment",
      reference: record.paymentDetails?.reference || record.reference,
      received: amount,
    },
  };
  return billingPDF(value, record.kind);
}
