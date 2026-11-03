import "../public/packages.js";
import { packageTerms } from "./package-terms.mjs";
export const agreementText = (_business, packageId = "inner-code") =>
  packageTerms(packageId);
export async function pdfDocument(record) {
  const { billingPDF } = await import("./billing.mjs");
  const cfg =
    record.packageSnapshot || globalThis.innerCodePackages.get("inner-code");
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
    formatting: record.formatting,
    updatedAt: date,
    issuedAt: date,
    due: date,
    business: record.business,
    packageSnapshot: cfg,
    paymentStage: record.stage || (cfg.deposit ? "deposit" : "balance"),
    customer: { name: record.client, email: "" },
    currency: record.business.currency,
    items: [
      {
        name:
          record.kind === "agreement"
            ? cfg.name
            : cfg.name +
              (cfg.deposit
                ? record.amount === cfg.balance
                  ? " — Balance"
                  : " — Deposit"
                : " — Full Payment"),
        description: cfg.description,
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
        ? `CAD ${cfg.price} total. ${cfg.deposit ? "CAD 150 deposit, then CAD 350 after the plan walkthrough." : "Full payment before account access."}`
        : record.kind === "receipt"
          ? "Payment verified by Rituparna."
          : record.body ||
            "Payment instructions will be provided by Rituparna.",
    terms:
      record.previewTerms ||
      (record.isTest
        ? packageTerms(cfg.id)
        : record.body || packageTerms(cfg.id)),
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
