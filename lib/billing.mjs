import { randomUUID } from "node:crypto";
import PDFDocument from "pdfkit";
import { colours, pageHeader } from "./brand.mjs";
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
    currency: text(b.currency, 3).toUpperCase(),
    price: Number(b.price),
    tax: Number(b.tax || 0),
    terms: text(b.terms, 20000),
    approved: b.approved === true,
    archived: b.archived === true,
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
  if (p.approved && !p.terms)
    invalid("A reviewed Service Agreement template is required");
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
      name: text(i.name) || p.name,
      description: text(i.description, 2000),
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
    name: text(b.customer?.name),
    email: text(b.customer?.email, 254).toLowerCase(),
  };
  if (!customer.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))
    invalid("Enter the customer name and a valid email");
  const terms = text(b.terms, 20000),
    approved = b.approved === true;
  if (approved && !terms)
    invalid("Review the Service Agreement before approving it");
  return {
    customer,
    currency,
    items,
    due: date(b.due),
    notes: text(b.notes, 3000),
    payment: text(b.payment, 3000),
    terms,
    approved,
    business: structuredClone(business),
    subtotal: items.reduce((n, i) => n + i.subtotal, 0),
    discount: items.reduce((n, i) => n + i.discount, 0),
    tax: items.reduce((n, i) => n + i.taxAmount, 0),
    total: items.reduce((n, i) => n + i.total, 0),
  };
}
export function initialProducts(terms) {
  return [
    {
      id: "inner-code",
      version: 1,
      name: "Inner Code",
      kind: "Service",
      description:
        "Approximately one onboarding week followed by 30 days of personalised coaching.",
      price: 500,
      currency: "CAD",
      tax: 0,
      terms,
      approved: false,
      archived: false,
    },
  ];
}
export async function billingPDF(record, kind) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 44, bufferPages: true }),
      chunks = [];
    doc.on("data", (b) => chunks.push(b));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    let page = 1;
    const header = () => {
      pageHeader(doc, {
        number: page++,
        programme: "CLIENT SERVICES",
        label:
          record.status === "Draft" ? "DRAFT / NOT ISSUED" : "CLIENT DOCUMENT",
      });
      doc.y = 126;
    };
    header();
    doc.on("pageAdded", header);
    const money = (n) => `${record.currency} ${(n / 100).toFixed(2)}`;
    const paragraph = (s, size = 10) => {
      // Wrap explicitly so long agreements keep their header, footer and font.
      const font = () =>
        doc.font("BrandSans").fontSize(size).fillColor(colours.ink);
      font();
      const lineHeight = doc.currentLineHeight() + 3;
      const lines = [];
      for (const raw of String(s).split("\n")) {
        let line = "";
        for (const word of raw.split(/\s+/)) {
          if (line && doc.widthOfString(line + " " + word) > 507) {
            lines.push(line);
            line = "";
          }
          if (doc.widthOfString(word) > 507) {
            if (line) {
              lines.push(line);
              line = "";
            }
            for (const char of word) {
              if (doc.widthOfString(line + char) > 507) {
                lines.push(line);
                line = "";
              }
              line += char;
            }
          } else line += (line ? " " : "") + word;
        }
        lines.push(line);
      }
      for (const line of lines) {
        if (doc.y + lineHeight > 752) doc.addPage();
        font();
        const y = doc.y;
        doc.text(line, 44, y, { width: 507, lineBreak: false });
        doc.y = y + lineHeight;
      }
      doc.y += 12;
    };
    doc
      .font("BrandSerif")
      .fontSize(28)
      .fillColor(colours.navy)
      .text(kind === "agreement" ? "Service Agreement" : "Invoice", 44, 126);
    doc.y += 12;
    paragraph(
      `${record.reference || "DRAFT"} · Version ${record.version}\n${record.status === "Draft" ? "Prepared" : "Issued"}: ${(record.issuedAt || record.updatedAt).slice(0, 10)} · Due: ${record.due}`,
      9,
    );
    paragraph(
      `From: ${record.business.name}\n${record.business.address}\nseekbyritu@gmail.com\n\nBill To: ${record.customer.name}\n${record.customer.email}`,
    );
    if (kind === "invoice") {
      const tableHeader = () => {
        const y = doc.y;
        doc.roundedRect(44, y, 507, 28, 4).fill(colours.sage);
        doc.font("BrandBold").fontSize(8).fillColor(colours.green);
        for (const [label, x, w] of [
          ["PRODUCT / SERVICE", 54, 275],
          ["QTY", 338, 30],
          ["UNIT PRICE", 375, 78],
          ["AMOUNT", 465, 76],
        ])
          doc.text(label, x, y + 9, {
            width: w,
            align: x > 300 ? "right" : "left",
          });
        doc.y = y + 38;
      };
      tableHeader();
      for (const i of record.items) {
        const details = `${i.description}\nTax: ${i.tax}%${i.discount ? " · Discount: " + money(i.discount) : ""}`;
        const height =
          doc
            .font("BrandSans")
            .fontSize(9)
            .heightOfString(details, { width: 265, lineGap: 2 }) +
          doc
            .font("BrandBold")
            .fontSize(10)
            .heightOfString(i.name, { width: 265 }) +
          28;
        if (height > 560) {
          paragraph(
            `${i.name}\n${details}\n${i.quantity} × ${money(i.unit)} · Amount ${money(i.total)}`,
          );
          continue;
        }
        if (doc.y + height > 745) {
          doc.addPage();
          tableHeader();
        }
        const y = doc.y;
        doc
          .font("BrandBold")
          .fontSize(10)
          .fillColor(colours.ink)
          .text(i.name, 54, y, { width: 265 });
        doc
          .font("BrandSans")
          .fontSize(9)
          .fillColor(colours.muted)
          .text(details, 54, doc.y + 5, { width: 265, lineGap: 2 });
        for (const [value, x, w] of [
          [String(i.quantity), 338, 30],
          [money(i.unit), 375, 78],
          [money(i.total), 465, 76],
        ])
          doc
            .font("BrandSans")
            .fontSize(8)
            .fillColor(colours.ink)
            .text(value, x, y, { width: w, align: "right" });
        doc
          .moveTo(44, y + height - 10)
          .lineTo(551, y + height - 10)
          .strokeColor(colours.line)
          .stroke();
        doc.y = y + height;
      }
      if (doc.y > 610) doc.addPage();
      const summaryY = doc.y + 8;
      doc
        .font("BrandSans")
        .fontSize(10)
        .fillColor(colours.ink)
        .text(
          `Subtotal: ${money(record.subtotal)}\nDiscount: ${money(record.discount)}\nTax: ${money(record.tax)}`,
          310,
          summaryY,
          { width: 231, align: "right", lineGap: 5 },
        );
      doc.y += 16;
      if (doc.y > 660) doc.addPage();
      const totalY = doc.y;
      doc.roundedRect(300, totalY, 251, 42, 5).fill(colours.sage);
      doc
        .font("BrandBold")
        .fontSize(16)
        .fillColor(colours.green)
        .text(`Total Due: ${money(record.total)}`, 310, totalY + 10, {
          width: 231,
          align: "right",
        });
      doc.y = totalY + 60;
      paragraph(
        `Payment Instructions\n${record.payment || "To be confirmed before issuing."}`,
      );
      if (record.notes) paragraph(record.notes);
      paragraph(
        "Thank you for choosing Seek by Ritu. This invoice is a payment request, not a payment receipt.",
        9,
      );
    } else {
      paragraph(
        `Services / Payment Items: ${record.items.map((i) => i.name).join(", ")}\nInvoice Amount: ${money(record.total)}\nPayment Due: ${record.due}\n${record.payment}`,
      );
      paragraph(
        record.terms || "Service Agreement terms have not been supplied.",
      );
      paragraph(
        "Client Signature: __________________________\nDate: __________________\n\nCoach Signature: __________________________\nDate: __________________",
      );
    }
    doc.end();
  });
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
      return stored.length ? stored : initialProducts(seedTerms);
    },
    documents: () => list("billing_documents"),
    async saveProduct(b) {
      const products = await this.products(),
        old = products.find((p) => p.id === b.id);
      if (b.id && !old) invalid("Product not found", 404);
      if (old && b.version !== old.version)
        invalid(
          "Product changed on another device. Reload before editing.",
          409,
        );
      if (!products.some((p) => p.id !== "inner-code"))
        for (const p of products) await put("billing_catalogue", p);
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
        !d.terms ||
        !d.payment ||
        /to be (agreed|provided|confirmed)|suggested.{0,30}approval|must be finalised|add payment method|terms.{0,20}pending/i.test(
          d.terms + " " + d.payment,
        )
      )
        invalid(
          "Review and approve the Service Agreement and add payment instructions before issuing.",
          409,
        );
      const counter =
        Number(
          (
            await db.query(
              "SELECT value FROM metadata WHERE name='billing_number'",
            )
          )[0]?.value || 0,
        ) + 1;
      await db.query(
        "INSERT INTO metadata(name,value) VALUES('billing_number',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value",
        [String(counter)],
      );
      d.reference = `SBR-${new Date().getUTCFullYear()}-${String(counter).padStart(5, "0")}`;
      d.status = "Issued";
      d.issuedAt = new Date().toISOString();
      d.version++;
      await put("billing_documents", d);
      return d;
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
