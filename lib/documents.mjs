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
export async function pdfDocument({
  isTest,
  kind,
  business,
  client,
  reference,
  amount,
  date,
  body,
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 44 }),
      chunks = [];
    doc.on("data", (b) => chunks.push(b));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    pageHeader(doc, {
      label: isTest
        ? "TEST CLIENT — NOT A REAL PAYMENT"
        : kind === "agreement" && !body
          ? "DRAFT — TERMS TO FINALISE"
          : business.address
            ? "PRIVATE CLIENT DOCUMENT"
            : "DRAFT — DETAILS PENDING",
    });
    if (kind === "agreement") {
      documentTitle(
        doc,
        "Service Agreement",
        "Inner Code | Personalised self-mastery coaching",
      );
      doc
        .font("BrandSans")
        .fontSize(9)
        .fillColor(colours.ink)
        .text(
          body
            ? `${business.name} | ${business.address} | ${business.currency}\nClient: ${client}\n\n${body}\n\nClient signature: __________________  Date: __________`
            : agreementText(business),
          44,
          199,
          { width: 507, lineGap: 2 },
        );
    } else {
      documentTitle(
        doc,
        kind === "receipt" ? "Payment Receipt" : "Payment Request / Invoice",
        kind === "receipt"
          ? "Issued after coach verification of the recorded payment."
          : "Review the agreed terms and approved payment instructions.",
      );
      clause(doc, "Issued By", business.name || "Business details pending");
      clause(doc, "Prepared For", client);
      clause(
        doc,
        "Document Record",
        `Reference: ${reference} | Issued: ${date}`,
      );
      amountBand(
        doc,
        [
          [
            "Amount",
            `${business.currency || "Currency Pending"} ${amount.toFixed(2)}`,
          ],
        ],
        doc.y + 8,
      );
      clause(doc, "Payment Details", body || "Payment instructions pending.");
      clause(doc, "Business Address", business.address || "Address pending.");
      draftNotice(
        doc,
        "Tax treatment and business registration details must be confirmed. No tax has been calculated. Invoice and receipt records are distinct from a bank or payment processor verification.",
        Math.max(doc.y + 15, 660),
      );
    }
    doc.end();
  });
}
