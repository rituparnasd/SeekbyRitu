import { recordDocumentEvent } from "./communications.mjs";
import { documentValue } from "./documents.mjs";
import "../public/packages.js";
const conflict = (message) => {
  throw Object.assign(Error(message), { status: 409 });
};
export const paymentStage = (p, amount) => {
  const cfg = globalThis.innerCodePackages.get(p);
  if (globalThis.innerCodePackages.fullPayment(p))
    return amount === 50000 ? "full" : null;
  if (!cfg.deposit) return amount === cfg.price * 100 ? "balance" : null;
  return amount === 15000 ? "deposit" : amount === 35000 ? "balance" : null;
};
export function programmeLedger(db, crypt) {
  const list = async (section) =>
    (
      await db.query("SELECT payload FROM documents WHERE section=?", [section])
    ).map((r) => crypt.open(r.payload));
  const put = async (section, value) => {
    await db.query(
      "INSERT INTO documents(section,record_key,payload) VALUES(?,?,?) ON CONFLICT(section,record_key) DO UPDATE SET payload=excluded.payload",
      [section, value.id, crypt.seal(value)],
    );
    await recordDocumentEvent(db, crypt, section, value);
  };
  const linked = async (id, stage) =>
    (await list("billing_documents")).filter(
      (d) =>
        d.clientId === id &&
        d.paymentStage === stage &&
        d.status === "Issued" &&
        !d.supersededBy,
    );
  const review = async (id, stage, documents) =>
    put("billing_sync_reviews", {
      id: id + ":" + stage,
      client: id,
      stage,
      status: "Needs Review",
      reason:
        "Existing Billing and Client records require owner review before linking. No historical document was renumbered or deleted.",
      documents: documents.map((d) => ({
        id: d.id,
        reference: d.reference,
        total: d.total,
      })),
      updatedAt: new Date().toISOString(),
    });
  return {
    list,
    put,
    async resolve(s, id, kind, stage, legacy) {
      if (kind === "agreement") return legacy(kind, stage);
      const p = s.programmes[id] || {};
      if (globalThis.innerCodePackages.fullPayment(p)) stage = "full";
      else if (!globalThis.innerCodePackages.get(p).deposit) stage = "balance";
      const lead = s.leads.find((l) => l.id === id);
      let invoices = await linked(id, stage);
      if (invoices.length > 1)
        conflict(
          "Multiple linked invoices need review before generating another receipt.",
        );
      let invoice = invoices[0];
      if (!invoice) {
        const deleted = (await list("billing_document_events")).find(
          (d) => d.clientId === id && d.paymentStage === stage,
        );
        if (deleted)
          conflict(
            "The linked invoice was deleted. Create a replacement in Billing; the deleted invoice will not be regenerated.",
          );
        const existing = (await list("billing_documents")).filter(
          (d) =>
            !d.clientId &&
            d.status === "Issued" &&
            d.customer?.email?.toLowerCase() === lead?.email?.toLowerCase() &&
            paymentStage(p, d.total) === stage,
        );
        if (existing.length) {
          await review(id, stage, existing);
          // Preserve the already-sent Client receipt until the owner approves reconciliation.
          return { ...(await legacy(kind, stage)), syncReviewRequired: true };
        }
        const original = await legacy("invoice", stage);
        const agreement = await legacy("agreement", stage);
        invoice = {
          ...documentValue(original),
          id: "program:" + id + ":" + stage,
          clientId: id,
          paymentStage: stage,
          source: "Client",
          requiresAgreement: true,
          approved: !!agreement.body,
          status: "Issued",
          terms: agreement.body,
          formatting: {
            ...documentValue(original).formatting,
            terms: agreement.formatting?.terms,
          },
          createdAt: new Date().toISOString(),
        };
        invoice.items = invoice.items.map((item) => ({
          ...item,
          productId: globalThis.innerCodePackages.get(p).id,
        }));
        await put("billing_documents", invoice);
      }
      if (kind === "invoice")
        return { kind, billingRecord: invoice, reference: invoice.reference };
      const payments = (await list("billing_payments")).filter(
        (r) => r.invoiceId === invoice.id,
      );
      if (payments.length) {
        const latest = payments
          .slice()
          .sort((a, b) => b.receipt.received - a.receipt.received)[0];
        if (latest.receipt.received !== invoice.total)
          conflict(
            "A partial payment is already recorded. Record the remaining payment in Billing before confirming completion.",
          );
        return { kind, billingRecord: latest, reference: latest.reference };
      }
      if (!(stage === "full" ? p.full : p[stage]))
        conflict("Payment has not been confirmed.");
      const original = await legacy("receipt", stage),
        value = documentValue(original);
      const receipt = {
        ...invoice,
        id: "program-payment:" + id + ":" + stage,
        invoiceId: invoice.id,
        invoiceReference: invoice.reference,
        reference: original.reference,
        status: "Receipt",
        receipt: value.receipt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const duplicate = (await list("billing_payments")).find(
        (r) =>
          r.receipt?.reference === receipt.receipt.reference &&
          r.receipt?.method === receipt.receipt.method &&
          !r.isTest,
      );
      if (duplicate) {
        await review(id, stage, [invoice, duplicate]);
        return { ...original, syncReviewRequired: true };
      }
      await put("billing_payments", receipt);
      return { kind, billingRecord: receipt, reference: receipt.reference };
    },
    async bindInvoice(s, invoice) {
      const leads = s.leads.filter(
        (l) => l.email.toLowerCase() === invoice.customer?.email?.toLowerCase(),
      );
      if (leads.length !== 1 || invoice.items?.length !== 1) return invoice;
      const id = leads[0].id,
        p = s.programmes[id];
      if (
        !p ||
        invoice.items[0].productId !== globalThis.innerCodePackages.get(p).id ||
        invoice.currency !== "CAD"
      )
        return invoice;
      const stage = paymentStage(p, invoice.total);
      if (!stage) return invoice;
      const previous = await linked(id, stage);
      const replaced = previous.filter((d) => d.id !== invoice.id);
      if (replaced.length) {
        if (replaced.length !== 1 || invoice.revises !== replaced[0].reference)
          conflict(
            "A linked invoice already exists for this payment. Open it from the Client section instead of issuing a duplicate.",
          );
        if (
          (await list("billing_payments")).some(
            (r) => r.invoiceId === replaced[0].id,
          )
        )
          conflict(
            "A paid invoice cannot be replaced through this revision. Review its existing payment and receipt first.",
          );
        await put("billing_documents", {
          ...replaced[0],
          supersededBy: invoice.id,
          updatedAt: new Date().toISOString(),
        });
      }
      // Historical unlinked Client documents require a reconciliation decision, never a silent replacement.
      const old = await db.query("SELECT payload FROM financial_documents");
      const historical = old
        .map((r) => crypt.open(r.payload))
        .filter(
          (r) =>
            r.customerEmail?.toLowerCase() ===
              invoice.customer.email.toLowerCase() &&
            r.stage === stage &&
            r.kind !== "agreement",
        );
      if (historical.length && !replaced.length) {
        await review(id, stage, [invoice, ...historical]);
        return invoice;
      }
      const value = {
        ...invoice,
        clientId: id,
        paymentStage: stage,
        ...(stage === "full"
          ? {
              receiptServiceDescription:
                "Inner Code: Personalized Health, Wellness & Self-Mastery Coaching",
            }
          : {}),
      };
      await put("billing_documents", value);
      return value;
    },
    applyPayment(s, payment) {
      const id = payment.clientId,
        p = s.programmes[id];
      if (!id || !p) return false;
      if (payment.receipt.received !== payment.total) return false;
      const stage = payment.paymentStage;
      p[stage] = true;
      if (stage === "full") {
        p.deposit = true;
        p.balance = true;
      }
      p.paymentDetails ??= {};
      p.verifiedAt ??= {};
      p.paymentDetails[stage] = {
        date: payment.receipt.date,
        method: payment.receipt.method,
        reference: payment.receipt.reference,
      };
      p.verifiedAt[stage] ??= new Date().toISOString();
      if (stage === "full") p.verifiedAt.balance ??= p.verifiedAt.full;
      return true;
    },
  };
}
