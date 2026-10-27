import PDFDocument from "pdfkit";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import {
  colours,
  pageHeader,
  documentTitle,
  clause,
  amountBand,
  draftNotice,
} from "../lib/brand.mjs";
const destination = new URL("../docs/templates/", import.meta.url);
await mkdir(destination, { recursive: true });
function agreement(doc) {
  pageHeader(doc, { number: 1, label: "DRAFT — TERMS TO FINALISE" });
  documentTitle(
    doc,
    "Coaching Agreement",
    "One onboarding week. Thirty days of conscious action. Clear shared commitments.",
  );
  amountBand(doc, [
    ["Total Payments", "CAD 500"],
    ["Refundable Deposit", "CAD 150"],
    ["Programme Fee", "CAD 350"],
  ]);
  clause(
    doc,
    "01 / Parties",
    "Rituparna Das, operating as BLINDSPOT STUDIOS, delivering Inner Code under the Seek by Ritu brand (Coach), and [Client Full Name] (Client). Agreement date: [Date].",
  );
  clause(
    doc,
    "02 / Programme",
    "One onboarding week followed by 30 tracking days across Health, Relationships, Career, Money and Spirituality. Includes a personalised plan, assigned resources, four daily check-ins and ten 20-minute calls on Days 3, 6, 9, 12, 15, 18, 21, 24, 27 and 30. Onboarding includes a separate 30-minute plan walkthrough.",
  );
  clause(
    doc,
    "03 / Payments & Start",
    "CAD 150 deposit at enrolment; CAD 350 after the walkthrough. Plan preparation takes three business days after completed onboarding answers are received. Tracking begins the day after balance payment is verified, in the agreed time zone.",
  );
  clause(
    doc,
    "04 / Deposit & Completion",
    "Proposed condition: the CAD 150 deposit is refundable upon achieving 95% completion; below 95% it is not refunded, subject to applicable law. The commitments counted, calculation, adaptations, refund timing, early cancellation and termination treatment must be finalised before signature.",
  );
  clause(
    doc,
    "05 / Participation",
    "The Client chooses work blocks, follows agreed commitments and reports honestly. Reviews consider incomplete actions and relevant circumstances. Agreed health adaptations and recovery are not automatically non-adherence.",
  );
  clause(
    doc,
    "06 / Removal & Re-entry",
    "Warning thresholds, notice, removal conditions and payment effects remain to be agreed in writing. Proposed re-entry requires seven consecutive days of independent agreed tasks with manual reporting and Coach review. Future enrolment after renewed non-adherence is subject to final terms.",
  );
  clause(
    doc,
    "07 / Scope & Privacy",
    "Coaching is educational, not medical or mental-health treatment, legal advice or financial advice. No specific result is guaranteed. Personal information and any AI processing are subject to a privacy notice and informed consent.",
  );
  clause(
    doc,
    "08 / Cancellation & Final Approval",
    "Cancellation, refund and rescheduling terms require completion and review for applicable consumer rights. This working draft is not approved for signature, payment collection or enrolment.",
  );
  const y = Math.max(doc.y + 13, 716);
  doc
    .moveTo(44, y + 18)
    .lineTo(265, y + 18)
    .moveTo(318, y + 18)
    .lineTo(551, y + 18)
    .strokeColor(colours.line)
    .stroke();
  doc
    .font("BrandSans")
    .fontSize(8)
    .fillColor(colours.muted)
    .text("Client Signature / Date", 44, y + 26)
    .text("Coach Signature / Date", 318, y + 26);
}
function party(doc) {
  clause(
    doc,
    "Issued By",
    "Rituparna Das / BLINDSPOT STUDIOS  |  Alberta Registration: TN28592426",
  );
  clause(doc, "Prepared For", "[Client Full Name]  |  [Client Email]");
  clause(
    doc,
    "Document Details",
    "Reference: [Document Number]     Issued: [Date]     Due: [Date]",
  );
}
function deposit(doc) {
  pageHeader(doc, { number: 2, label: "DRAFT — DO NOT SEND" });
  documentTitle(
    doc,
    "Deposit Payment Request",
    "Your first step into Inner Code. Review and sign the final agreement before payment.",
  );
  party(doc);
  amountBand(
    doc,
    [
      ["Deposit Requested", "CAD 150.00"],
      ["Later Balance", "CAD 350.00"],
    ],
    doc.y + 8,
  );
  clause(
    doc,
    "Programme",
    "One week of onboarding followed by 30 days of tracking and coaching. Total proposed payments: CAD 500.00.",
  );
  clause(
    doc,
    "Payment Instructions",
    "Method: [Payment Method]\nPayment details: [Payment Details]\nPayment reference: [Client / Document Reference]",
  );
  clause(
    doc,
    "Refund Conditions",
    "95% completion is the proposed deposit-return condition. The calculation method, return timing, adaptations and cancellation treatment must be finalised before sending.",
  );
  clause(
    doc,
    "What Happens Next",
    "Signed agreement + verified deposit → payment receipt and onboarding questionnaire → plan preparation → 30-minute walkthrough → balance payment request.",
  );
  draftNotice(
    doc,
    "REVIEW BEFORE USE: confirm final deposit terms, payment details, tax treatment, due date and agreement acceptance. No payment method or banking information has been invented.",
    Math.max(doc.y + 12, 670),
  );
}
function balance(doc) {
  pageHeader(doc, { number: 3, label: "DRAFT — DO NOT SEND" });
  documentTitle(
    doc,
    "Balance Invoice",
    "Following your plan walkthrough. The next step is programme activation.",
  );
  party(doc);
  amountBand(
    doc,
    [
      ["Total Proposed", "CAD 500.00"],
      ["Deposit Received", "CAD 150.00"],
      ["Balance Due", "CAD 350.00"],
    ],
    doc.y + 8,
  );
  clause(
    doc,
    "Programme",
    "Inner Code: personalised coaching following the completed plan walkthrough. Deposit received on [Date Received].",
  );
  clause(
    doc,
    "Payment Instructions",
    "Due: [Date]\nMethod: [Payment Method]\nInstructions: [Payment Details]",
  );
  clause(
    doc,
    "Programme Start",
    "After the balance is verified, tracking starts the following day in the agreed time zone. The personalised plan appears in the activated account; it is not sent as an email attachment.",
  );
  clause(
    doc,
    "Deposit Status",
    "The CAD 150 deposit remains subject to the final agreed refund conditions.",
  );
  draftNotice(
    doc,
    "REVIEW BEFORE USE: confirm payment records, invoice number, due date, currency and applicable tax treatment. This draft does not assume that tax is payable or exempt.",
    Math.max(doc.y + 12, 670),
  );
}
function receipt(doc) {
  pageHeader(doc, {
    number: 4,
    label: "DRAFT — ISSUE ONLY AFTER VERIFICATION",
  });
  documentTitle(
    doc,
    "Payment Receipt",
    "A clear record of the amount actually received or returned.",
  );
  party(doc);
  amountBand(
    doc,
    [
      ["Amount Verified", "CAD [Amount]"],
      ["Transaction Date", "[Date]"],
    ],
    doc.y + 8,
  );
  clause(doc, "Receipt For", "[Deposit / Balance / Deposit Refund]");
  clause(
    doc,
    "Transaction Record",
    "Payment method: [Method]\nPayment / refund reference: [Transaction Reference]\nVerified by: [Name]     Verification date: [Date]",
  );
  const y = doc.y + 5;
  doc.roundedRect(44, y, 507, 135, 5).fill(colours.paper);
  let rowY = y + 17;
  for (const [label, value] of [
    ["Deposit Received", "CAD [Amount]"],
    ["Balance Received", "CAD [Amount]"],
    ["Total Received", "CAD [Amount]"],
    ["Outstanding", "CAD [Amount]"],
    ["Deposit Returned, If Applicable", "CAD [Amount]"],
  ]) {
    doc
      .font("BrandSans")
      .fontSize(9)
      .fillColor(colours.ink)
      .text(label, 60, rowY, { width: 310 })
      .font("BrandBold")
      .text(value, 375, rowY, { width: 160, align: "right" });
    rowY += 23;
  }
  doc.y = y + 155;
  clause(
    doc,
    "Important",
    "Issue only after the payment or refund is verified. A payment request, reported transfer or screenshot alone is not a verified receipt. This is a reusable blank template.",
  );
  draftNotice(
    doc,
    "REVIEW BEFORE USE: populate actual amounts and references. Keep the receipt number unique and retain the verified transaction record.",
    Math.max(doc.y + 12, 690),
  );
}
const pages = [
  ["01-Coaching-Agreement-DRAFT.pdf", agreement],
  ["02-Deposit-Payment-Request-DRAFT.pdf", deposit],
  ["03-Balance-Invoice-DRAFT.pdf", balance],
  ["04-Payment-Receipt-DRAFT.pdf", receipt],
];
async function write(name, draw) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 44,
    autoFirstPage: false,
    info: {
      Title: "Inner Code — Seek by Ritu",
      Author: "Rituparna Das / BLINDSPOT STUDIOS",
    },
  });
  const stream = createWriteStream(new URL(name, destination));
  doc.pipe(stream);
  draw(doc);
  doc.end();
  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}
for (const [name, draw] of pages)
  await write(name, (doc) => {
    doc.addPage();
    draw(doc);
  });
await write("Inner-Code-Agreement-and-Payment-Pack-DRAFT.pdf", (doc) => {
  for (const [, draw] of pages) {
    doc.addPage();
    draw(doc);
  }
});
console.log("Created four branded draft documents and combined pack.");
