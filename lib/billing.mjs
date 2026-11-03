import {
  deleteBillingDocument,
  restoreBillingDraft,
} from "./billing-deletion.mjs";
import "../public/document-format.js";
import { hasUnresolvedTerms, termsReviewMessage } from "./terms-review.mjs";
import { randomUUID } from "node:crypto";
import { documentReference } from "./document-references.mjs";
import "../public/packages.js";
import "../public/payment-links.js";
import "../public/calendar.js";
import { packageTerms } from "./package-terms.mjs";
const invalid = (message, status = 400) => {
  throw Object.assign(Error(message), { status });
};
const text = (v, max = 200) =>
  String(v ?? "")
    .trim()
    .slice(0, max);
const date = (v) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v || "") &&
  !isNaN(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v
    ? v
    : invalid("Choose a valid due date");
export function productInput(b) {
  const p = {
    name: text(b.name),
    kind: b.kind === "Product" ? "Product" : "Service",
    description: text(b.description, 2000),
    nextSteps: text(b.nextSteps, 5000),
    currency: text(b.currency, 3).toUpperCase(),
    price: Number(b.price),
    tax: Number(b.tax || 0),
    terms: text(b.terms, 20000),
    approved: b.approved === true,
    archived: b.archived === true,
    requiresAgreement: b.requiresAgreement ?? b.kind !== "Product",
  };
  if (
    !p.name ||
    !/^[A-Z]{3}$/.test(p.currency) ||
    !Number.isFinite(p.price) ||
    p.price < 0 ||
    p.price > 1e7 ||
    !Number.isFinite(p.tax) ||
    p.tax < 0 ||
    p.tax > 100
  )
    invalid("Enter a name, currency, valid price and tax rate");
  p.price = Math.round(p.price * 100) / 100;
  if (p.approved && p.requiresAgreement && !p.terms)
    invalid("A reviewed Service Agreement template is required");
  if (p.approved && p.requiresAgreement && hasUnresolvedTerms(p.terms))
    invalid(termsReviewMessage(p.terms));
  p.formatting = Object.fromEntries(
    ["description", "terms", "nextSteps"]
      .filter((key) => b.formatting?.[key])
      .map((key) => [
        key,
        globalThis.documentFormat.normalize(b.formatting[key], p[key]),
      ]),
  );
  return p;
}
export function documentInput(b, products, business) {
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 30)
    invalid("Add between 1 and 30 invoice items");
  const items = b.items.map((i) => {
    const p = products.find((p) => p.id === i.productId && !p.archived);
    if (!p) invalid("Select an active product or service");
    const quantity = Number(i.quantity),
      unit = Math.round(Number(i.price) * 100),
      discount = Math.round(Number(i.discount || 0) * 100),
      tax = Number(i.tax);
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 10000 ||
      !Number.isSafeInteger(unit) ||
      unit < 0 ||
      unit > 1e9 ||
      !Number.isSafeInteger(discount) ||
      discount < 0 ||
      discount > unit * quantity ||
      !Number.isFinite(tax) ||
      tax < 0 ||
      tax > 100
    )
      invalid("Check item quantity, price, discount and tax");
    const subtotal = quantity * unit,
      net = subtotal - discount,
      taxAmount = Math.round((net * tax) / 100);
    return {
      productId: p.id,
      productVersion: p.version,
      packageSnapshot: globalThis.innerCodePackages.all.find(
        (c) => c.id === p.id,
      )
        ? structuredClone(globalThis.innerCodePackages.get(p.id))
        : undefined,
      requiresAgreement: p.requiresAgreement ?? p.kind !== "Product",
      name: text(i.name) || p.name,
      description: text(i.description, 2000),
      nextSteps: p.nextSteps || globalThis.programmeContent.nextText(p.id),
      formatting: {
        description: globalThis.documentFormat.normalize(
          i.formatting?.description ||
            (text(i.description, 2000) === p.description
              ? p.formatting?.description
              : undefined),
          text(i.description, 2000),
        ),
      },
      currency: p.currency,
      quantity,
      unit,
      discount,
      tax,
      subtotal,
      taxAmount,
      total: net + taxAmount,
    };
  });
  const currency = items[0].currency;
  if (items.some((i) => i.currency !== currency))
    invalid("All items must use the same currency");
  const customer = {
    phone: text(b.customer?.phone, 100),
    name: text(b.customer?.name),
    email: text(b.customer?.email, 254).toLowerCase(),
  };
  if (!customer.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))
    invalid("Enter the customer name and a valid email");
  const terms = text(b.terms, 20000),
    approved = b.approved === true;
  const requiresAgreement =
    b.requiresAgreement ?? items.some((i) => i.requiresAgreement);
  if (approved && requiresAgreement && (!terms || hasUnresolvedTerms(terms)))
    invalid(termsReviewMessage(terms));
  const expectedLink =
    items.length === 1 &&
    items[0].quantity === 1 &&
    !items[0].discount &&
    !items[0].taxAmount
      ? globalThis.innerCodePayments.url(
          items[0].productId,
          items[0].total / 100,
          currency,
        )
      : "";
  const expectedPayment =
    items.length === 1 &&
    items[0].quantity === 1 &&
    !items[0].discount &&
    !items[0].taxAmount &&
    currency === "CAD"
      ? globalThis.programmeContent.payment(
          items[0].productId,
          items[0].total / 100,
        )
      : "";
  for (const packageId of [
    "inner-code",
    "inner-code-guided",
    "inner-code-self-guided",
  ]) {
    const cfg = globalThis.programmeContent.get(packageId);
    for (const amount of cfg.deposit
      ? [cfg.deposit, cfg.balance]
      : [cfg.price]) {
      const instructions = globalThis.programmeContent.payment(
        packageId,
        amount,
      );
      if (
        instructions &&
        String(b.payment || "").includes(instructions) &&
        instructions !== expectedPayment
      )
        invalid(
          "The payment request does not match this invoice amount. Clear the instructions or provide matching custom payment instructions.",
        );
    }
  }
  for (const link of Object.values(globalThis.innerCodePayments.links)) {
    if (String(b.payment || "").includes(link) && link !== expectedLink)
      invalid(
        "The Stripe link does not match this invoice amount. Clear payment instructions or provide a matching custom payment link.",
      );
  }
  return {
    customer,
    packageSnapshot: items.length === 1 ? items[0].packageSnapshot : undefined,
    currency,
    items,
    due: date(b.due),
    issueDate: date(b.issueDate || globalThis.coachingTime.today()),
    agreementDate: b.agreementDate ? date(b.agreementDate) : "",
    notes: text(b.notes, 3000),
    nextSteps: Object.hasOwn(b, "nextSteps")
      ? text(b.nextSteps, 5000)
      : items
          .map((item) => item.nextSteps)
          .filter(Boolean)
          .join("\n\n"),
    payment:
      text(b.payment, 3000) ||
      (items.length === 1 &&
      items[0].quantity === 1 &&
      !items[0].discount &&
      !items[0].taxAmount
        ? globalThis.innerCodePayments.instructions(
            items[0].productId,
            items[0].total / 100,
            currency,
          )
        : ""),
    terms,
    formatting: Object.fromEntries(
      ["payment", "notes", "terms", "nextSteps"]
        .filter((key) => b.formatting?.[key])
        .map((key) => [
          key,
          globalThis.documentFormat.normalize(
            b.formatting[key],
            text(
              b[key],
              key === "terms" ? 20000 : key === "nextSteps" ? 5000 : 3000,
            ),
          ),
        ]),
    ),
    approved,
    requiresAgreement,
    business: structuredClone(business),
    subtotal: items.reduce((n, i) => n + i.subtotal, 0),
    discount: items.reduce((n, i) => n + i.discount, 0),
    tax: items.reduce((n, i) => n + i.taxAmount, 0),
    total: items.reduce((n, i) => n + i.total, 0),
  };
}
export function initialProducts(terms) {
  return globalThis.innerCodePackages.all.map((p) => ({
    id: p.id,
    version: 1,
    name: p.name,
    kind: "Service",
    description: p.description,
    price: p.price,
    currency: "CAD",
    tax: 0,
    terms: p.id === "inner-code" ? terms : packageTerms(p.id),
    nextSteps: globalThis.programmeContent.nextText(p.id),
    approved: false,
    archived: false,
    requiresAgreement: true,
    packageSnapshot: structuredClone(p),
  }));
}
export async function billingPDF(record, kind) {
  const { referenceDocumentPDF } = await import("./reference-documents.mjs");
  return referenceDocumentPDF(record, kind);
}
export function billingStore(db, crypt, seedTerms) {
  const list = async (section) =>
    (
      await db.query("SELECT payload FROM documents WHERE section=?", [section])
    ).map((r) => crypt.open(r.payload));
  const put = async (section, r) =>
    db.query(
      "INSERT INTO documents(section,record_key,payload) VALUES(?,?,?) ON CONFLICT(section,record_key) DO UPDATE SET payload=excluded.payload",
      [section, r.id, crypt.seal(r)],
    );
  return {
    async products() {
      const stored = await list("billing_catalogue");
      return [
        ...stored,
        ...initialProducts(seedTerms).filter(
          (p) => !stored.some((old) => old.id === p.id),
        ),
      ];
    },
    documents: () => list("billing_documents"),
    trash: () => list("billing_trash"),
    deleteDocument(b) {
      return deleteBillingDocument(db, crypt, b);
    },
    restoreDraft(b) {
      return restoreBillingDraft(db, crypt, b);
    },
    async saveProduct(b) {
      const products = await this.products(),
        old = products.find((p) => p.id === b.id);
      if (b.id && !old) invalid("Product not found", 404);
      if (old && b.version !== old.version)
        invalid(
          "Product changed on another device. Reload before editing.",
          409,
        );
      for (const p of products)
        if (!(await list("billing_catalogue")).some((old) => old.id === p.id))
          await put("billing_catalogue", p);
      const p = {
        ...productInput(b),
        id: old?.id || randomUUID(),
        version: (old?.version || 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      await put("billing_catalogue", p);
      return p;
    },
    async saveDocument(b, business) {
      const docs = await this.documents(),
        old = docs.find((d) => d.id === b.id);
      if (b.id && !old) invalid("Document not found", 404);
      if (old && (old.status !== "Draft" || old.version !== b.version))
        invalid(
          "Issued documents are frozen. Create a revision, or reload a changed draft.",
          409,
        );
      const d = {
        ...documentInput(b, await this.products(), business),
        id: old?.id || randomUUID(),
        version: (old?.version || 0) + 1,
        status: "Draft",
        updatedAt: new Date().toISOString(),
        ...(old?.revises ? { revises: old.revises } : {}),
      };
      await put("billing_documents", d);
      return d;
    },
    async issue(id, version) {
      const d = (await this.documents()).find((d) => d.id === id);
      if (!d) invalid("Document not found", 404);
      if (d.status !== "Draft" || d.version !== version)
        invalid("Document changed. Reload before issuing.", 409);
      if (
        !d.approved ||
        (d.requiresAgreement && !d.terms) ||
        !d.payment ||
        (d.requiresAgreement && hasUnresolvedTerms(d.terms)) ||
        /add payment method/i.test(d.payment)
      )
        invalid(
          "Review and approve the Service Agreement and add payment instructions before issuing.",
          409,
        );
      d.reference = documentReference(
        d.packageSnapshot?.id || d.items[0]?.productId,
        new Set((await this.documents()).map((document) => document.reference)),
      );
      d.status = "Issued";
      d.issuedAt = new Date().toISOString();
      d.updatedAt = d.issuedAt;
      d.version++;
      await put("billing_documents", d);
      return d;
    },
    payments: () => list("billing_payments"),
    async recordPayment(b) {
      const invoice = (await this.documents()).find((d) => d.id === b.id);
      if (!invoice || invoice.status !== "Issued")
        invalid("Choose an issued invoice", 409);
      const payments = (await this.payments()).filter(
        (p) => p.invoiceId === b.id,
      );
      const received = payments.reduce((n, p) => n + p.receipt.amount, 0);
      const amount = Math.round(Number(b.amount) * 100);
      if (
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        amount > invoice.total - received ||
        b.verified !== true
      )
        invalid(
          "Verify a positive payment no greater than the outstanding balance",
        );
      const method = text(b.method, 100),
        reference = text(b.reference, 200);
      if (!method || !reference)
        invalid("Enter a payment method and transaction reference");
      if (
        payments.some(
          (p) =>
            p.receipt.reference === reference && p.receipt.method === method,
        )
      )
        invalid("That payment reference has already been recorded", 409);
      const payment = {
        ...structuredClone(invoice),
        id: randomUUID(),
        invoiceId: invoice.id,
        invoiceReference: invoice.reference,
        reference: documentReference(
          invoice.packageSnapshot?.id || invoice.items[0]?.productId,
          new Set((await this.payments()).map((receipt) => receipt.reference)),
        ),
        status: "Receipt",
        receipt: {
          amount,
          method,
          reference,
          date: date(b.date),
          received: received + amount,
        },
        updatedAt: new Date().toISOString(),
      };
      await put("billing_payments", payment);
      return payment;
    },
    async revise(id) {
      const old = (await this.documents()).find((d) => d.id === id);
      if (!old || old.status !== "Issued")
        invalid("Choose an issued document to revise", 409);
      const d = {
        ...old,
        id: randomUUID(),
        version: 1,
        status: "Draft",
        approved: false,
        revises: old.reference,
        updatedAt: new Date().toISOString(),
      };
      delete d.reference;
      delete d.issuedAt;
      await put("billing_documents", d);
      return d;
    },
  };
}
