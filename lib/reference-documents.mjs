import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";
import { logo, registerFonts } from "./brand.mjs";
import { drawFormattedText, formattedHeight } from "./formatted-text.mjs";
import "../public/programme-content.js";
import "../public/document-format.js";
const signature = fileURLToPath(
  new URL("../document-assets/coach-signature.png", import.meta.url),
);
const C = {
  navy: "#10283b",
  green: "#103f34",
  ink: "#263c3a",
  muted: "#657773",
  line: "#d5e1dc",
  light: "#e4eee8",
  paper: "#f1f4f2",
};
const X = 44,
  W = 507,
  BOTTOM = 758;
const markdown = (text, size = 10) =>
  String(text)
    .split("**")
    .map((text, index) => ({
      insert: text,
      attributes: {
        size: size + "pt",
        font: "helvetica",
        ...(index % 2 ? { bold: true } : {}),
      },
    }))
    .filter((op) => op.insert);
const simpleDate = (value) =>
  value ? String(value).slice(0, 10) : "____________________";
export function referenceDocumentPDF(record, kind) {
  return new Promise((resolve, reject) => {
    const doc = registerFonts(
        new PDFDocument({ size: "A4", margin: 0, bufferPages: true }),
      ),
      chunks = [];
    doc.on("data", (b) => chunks.push(b));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const cfg = record.packageSnapshot,
      content = globalThis.programmeContent.get(
        cfg?.id || record.items?.[0]?.productId,
      );
    const label =
      record.documentLabel ||
      content?.label ||
      cfg?.name ||
      record.items?.map((i) => i.name).join(" + ") ||
      "Client Services";
    const money = (n) =>
      `${record.currency || "CAD"} ${(Number(n) / 100).toFixed(2)}`;
    const issued =
      record.issueDate || simpleDate(record.issuedAt || record.updatedAt);
    const text = (
      value,
      x,
      y,
      width = W,
      size = 10,
      font = "Helvetica",
      color = C.ink,
      options = {},
    ) => {
      doc
        .font(font)
        .fontSize(size)
        .fillColor(color)
        .text(String(value ?? ""), x, y, { width, lineGap: 2, ...options });
      return doc.y;
    };
    const line = (y, x = X, width = W) =>
      doc
        .moveTo(x, y)
        .lineTo(x + width, y)
        .strokeColor(C.line)
        .lineWidth(0.7)
        .stroke();
    let pages = 0;
    const page = (continuation = false) => {
      if (pages) doc.addPage();
      pages++;
      if (continuation && ["agreement", "policy"].includes(kind)) {
        doc.y = 44;
        return;
      }
      doc.rect(0, 0, 595.28, 7).fill(C.green);
      doc.image(logo, 44, 39, { fit: [43, 54] });
      text("Seek by Ritu", 101, 38, 310, 25, "Times-Roman", C.navy);
      text("Seek by Ritu | " + label, 101, 69, 400, 9, "Helvetica", C.green);
      if (record.isTest || record.status === "Draft")
        text(
          record.isTest ? "SAMPLE" : "DRAFT",
          440,
          71,
          111,
          8,
          "Helvetica",
          C.muted,
          { align: "right" },
        );
      line(108);
      text(
        kind === "policy"
          ? "Privacy Policy"
          : kind === "agreement"
            ? "Service Agreement"
            : kind === "receipt"
              ? "Payment Receipt"
              : "Invoice",
        X,
        126,
        W,
        27,
        "Times-Roman",
        C.navy,
      );
      doc.y = 174;
    };
    const ensure = (height) => {
      if (doc.y + height > BOTTOM) page(true);
    };
    const rich = (
      delta,
      { x = X, width = W, size = 10, color = C.ink, gap = 5 } = {},
    ) =>
      drawFormattedText(doc, delta, {
        x,
        width,
        defaultSize: size,
        defaultFont: "Helvetica",
        colour: color,
        paragraphGap: gap,
        bottom: BOTTOM,
        newPage: () => page(true),
      });
    const body = (value, options = {}) =>
      rich(
        { ops: [...markdown(value, options.size || 10), { insert: "\n" }] },
        options,
      );
    const bullet = (value) =>
      rich({
        ops: [
          ...markdown(value),
          { insert: "\n", attributes: { list: "bullet" } },
        ],
      });
    page();
    if (kind === "policy") {
      text("Effective date: " + record.effectiveDate, X, doc.y, W, 10);
      doc.y += 20;
      for (const section of record.sections) {
        ensure(55);
        text(
          section.number + ". " + section.title,
          X,
          doc.y,
          W,
          11,
          "Helvetica-Bold",
          C.green,
        );
        doc.y += 7;
        for (const paragraph of section.paragraphs) {
          const delta = {
            ops: [
              ...markdown(paragraph.text),
              {
                insert: "\n",
                attributes: {
                  lineheight: "1.15",
                  ...(paragraph.bullet ? { list: "bullet" } : {}),
                },
              },
            ],
          };
          ensure(
            formattedHeight(doc, delta, {
              width: W,
              defaultSize: 10,
              defaultFont: "Helvetica",
            }) - 3,
          );
          rich(delta, { gap: 2 });
        }
        doc.y += 5;
      }
    } else if (kind === "agreement") {
      const metadata = [
        [
          "Provider:",
          record.business?.name?.replace(
            " / BLINDSPOT STUDIOS",
            ", operating as BLINDSPOT STUDIOS under Seek by Ritu.",
          ) ||
            "Rituparna Das, operating as BLINDSPOT STUDIOS under Seek by Ritu.",
        ],
        ["Client:", record.customer.name],
        ["Contact:", "seekbyritu@gmail.com"],
      ];
      for (const [key, value] of metadata) {
        const y = doc.y;
        const a = doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .widthOfString(key + " ");
        text(key, X, y, a, 10, "Helvetica-Bold");
        text(value, X + a, y, W - a, 10);
        doc.y = Math.max(y + 14.5, doc.y);
      }
      doc.y += 14;
      const canonicalTerms = globalThis.programmeContent.terms(
        cfg?.id || record.items?.[0]?.productId,
      );
      const canonical =
        !!content &&
        [
          canonicalTerms.trim(),
          canonicalTerms
            .replaceAll("[Client Name]", record.customer.name)
            .trim(),
        ].includes(record.terms?.trim());
      let delta = record.formatting?.terms;
      if (delta) {
        try {
          delta = globalThis.documentFormat.normalize(delta, record.terms);
        } catch {
          delta = undefined;
        }
      }
      if (!delta && canonical)
        delta = globalThis.programmeContent.delta(
          cfg?.id || record.items?.[0]?.productId,
        );
      if (delta) {
        const paragraphs = globalThis.documentFormat.paragraphs(delta);
        for (const paragraph of paragraphs) {
          const plain = paragraph.runs.map((r) => r.text).join("");
          if (
            /^(INNER CODE SERVICE AGREEMENT|Seek by Ritu\s*\||Provider:|Client:|Contact:)/i.test(
              plain,
            )
          )
            continue;
          if (!plain.trim()) {
            doc.y += 3;
            continue;
          }
          const heading = plain.match(/^(\d{1,2})[.)]\s+(.+)/);
          if (canonical && heading && Number(heading[1]) === 5) page(true);
          if (heading) {
            ensure(55);
            const runs = paragraph.runs.length
              ? paragraph.runs
              : [{ text: plain }];
            const hasCustom =
              runs.some(
                (run) => run.size || run.color || run.bold || run.font,
              ) || paragraph.attributes.header;
            if (!hasCustom) {
              body(`${heading[1].padStart(2, "0")}  ${heading[2]}`, {
                size: 11,
                color: C.green,
              });
            } else
              rich(
                {
                  ops: [
                    ...runs.map((run) => ({
                      insert: run.text.replace(
                        /^([1-9])[.)]\s+/,
                        (_, n) => n.padStart(2, "0") + "  ",
                      ),
                      attributes: Object.fromEntries(
                        Object.entries(run).filter(([k]) => k !== "text"),
                      ),
                    })),
                    { insert: "\n", attributes: paragraph.attributes },
                  ],
                },
                { size: 11, color: C.green },
              );
          } else {
            rich({
              ops: [
                ...paragraph.runs.map((run) => ({
                  insert: run.text,
                  attributes: Object.fromEntries(
                    Object.entries(run).filter(([k]) => k !== "text"),
                  ),
                })),
                { insert: "\n", attributes: paragraph.attributes },
              ],
            });
          }
        }
      } else {
        for (const block of (
          record.terms || "Service Agreement terms have not been supplied."
        ).split(/\n\n/)) {
          const rows = block.split("\n");
          for (const row of rows) {
            if (
              /^(INNER CODE SERVICE AGREEMENT|Seek by Ritu\s*\||Provider:|Client:|Contact:)/i.test(
                row,
              )
            )
              continue;
            const heading = row.match(/^(\d{1,2})[.)]\s+(.+)/);
            if (heading) {
              ensure(55);
              text(
                heading[1].padStart(2, "0") + "  " + heading[2],
                X,
                doc.y,
                W,
                11,
                "Helvetica-Bold",
                C.green,
              );
              doc.y += 9;
            } else if (/^\s*[•*-]\s/.test(row))
              bullet(row.replace(/^\s*[•*-]\s/, ""));
            else if (row.trim()) body(row);
          }
          doc.y += 5;
        }
      }
      if (record.acknowledgement)
        body(
          `Client acknowledgement: ${record.acknowledgement.name} | ${record.acknowledgement.at}`,
          { size: 9 },
        );
      if (doc.y + 130 > BOTTOM) page(true);
      const top = Math.max(doc.y + 20, canonical ? 576 : doc.y + 20);
      line(top);
      text("CLIENT", 44, top + 25, 216, 9, "Helvetica-Bold");
      text("COACH", 320, top + 25, 231, 9, "Helvetica-Bold");
      doc.image(signature, 320, top + 39, { fit: [75, 42.24] });
      line(top + 88, 44, 216);
      line(top + 88, 320, 231);
      text(record.customer.name, 44, top + 96, 216, 9);
      text("Rituparna Das", 320, top + 96, 231, 9);
      text(
        "Date: " + simpleDate(record.acknowledgement?.at),
        44,
        top + 111,
        216,
        9,
      );
      text("Date: " + simpleDate(record.agreementDate), 320, top + 111, 231, 9);
    } else {
      const meta =
        kind === "receipt"
          ? `Receipt: ${record.reference}    Payment date: ${record.receipt.date}`
          : `Invoice: ${record.reference || "DRAFT"}    Issued: ${issued}    Due: ${record.due}`;
      text(meta, X, 174, W, 9);
      doc.y = 211;
      const top = doc.y;
      text("FROM", X, top, 280, 9.5, "Helvetica-Bold");
      text("BILL TO", 355, top, 196, 9.5, "Helvetica-Bold");
      const from = text(
        `${record.business.name}\nSeek by Ritu\nseekbyritu@gmail.com${record.business.publicAddress ? "\n" + record.business.publicAddress : ""}`,
        X,
        top + 15,
        280,
        9.5,
      );
      const to = text(
        [record.customer.name, record.customer.email, record.customer.phone]
          .filter(Boolean)
          .join("\n"),
        355,
        top + 15,
        196,
        9.5,
      );
      doc.y = Math.max(from, to) + 18;
      if (kind === "receipt") {
        const y = doc.y;
        doc.roundedRect(X, y, W, 48, 4).fill(C.light);
        text(
          "PAYMENT RECEIVED",
          57,
          y + 16,
          300,
          10,
          "Helvetica-Bold",
          C.green,
        );
        text(
          money(record.receipt.amount),
          365,
          y + 12,
          173,
          19,
          "Helvetica-Bold",
          C.green,
          { align: "right" },
        );
        doc.y = y + 67;
        body(`Invoice: ${record.invoiceReference}`);
        body(`Method: ${record.receipt.method}`);
        body(`Transaction reference: ${record.receipt.reference}`);
        body(`Invoice total: ${money(record.total)}`);
        body(`Total received: ${money(record.receipt.received)}`);
        body(`Remaining due: ${money(record.total - record.receipt.received)}`);
      } else {
        const tableHeader = () => {
          const y = doc.y;
          doc.roundedRect(X, y, W, 29, 4).fill(C.green);
          text(
            "PRODUCT / SERVICE",
            57,
            y + 9,
            370,
            9,
            "Helvetica-Bold",
            "#ffffff",
          );
          text("AMOUNT", 450, y + 9, 88, 9, "Helvetica-Bold", "#ffffff", {
            align: "right",
          });
          doc.y = y + 38;
        };
        tableHeader();
        for (const item of record.items) {
          const canonicalItem =
            content &&
            record.items.length === 1 &&
            item.quantity === 1 &&
            !item.discount &&
            !item.taxAmount &&
            [content.price, content.deposit, content.balance].includes(
              item.unit / 100,
            );
          const descriptionHeight = item.formatting?.description
            ? formattedHeight(doc, item.formatting.description, {
                width: 400,
                defaultSize: 10,
                defaultFont: "Helvetica",
              })
            : doc
                .font("Helvetica")
                .fontSize(10)
                .heightOfString(item.description || "", { width: 400 }) + 20;
          if (doc.y + Math.min(descriptionHeight + 40, 250) > BOTTOM) {
            page(true);
            tableHeader();
          }
          const y = doc.y;
          const itemName = canonicalItem
            ? `${content.label} | ${content.deposit ? (item.unit / 100 === content.deposit ? "Deposit" : item.unit / 100 === content.balance ? "Balance" : "Full Payment") : "Full Payment"}`
            : item.name;
          text(itemName, 57, y, 380, 10.5, "Helvetica-Bold");
          const nameEnd = doc.y;
          text(money(item.total), 444, y, 94, 10.5, "Helvetica-Bold", C.navy, {
            align: "right",
          });
          doc.y = nameEnd + 11;
          if (canonicalItem && !item.formatting?.description) {
            for (const value of content.invoiceBullets) bullet(value);
          } else if (item.formatting?.description)
            rich(item.formatting.description, { x: 57, width: 400 });
          else body(item.description || "", { x: 57, width: 400 });
          if (!canonicalItem)
            body(
              `Quantity: ${item.quantity} | Unit: ${money(item.unit)}${item.discount ? " | Discount: " + money(item.discount) : ""}`,
              { size: 9 },
            );
          line(doc.y + 1);
          doc.y += 16;
        }
        ensure(132);
        const summaryY = doc.y;
        const values =
          content?.deposit && record.items.length === 1
            ? [
                ["TOTAL PROGRAM", `CAD ${content.price.toFixed(2)}`],
                [
                  record.paymentStage === "balance" || record.total === 35000
                    ? "DEPOSIT INCLUDED"
                    : "AFTER PLAN APPROVAL",
                  `CAD ${(record.total === 35000 ? content.deposit : content.balance).toFixed(2)}`,
                ],
                ["GST / HST", record.tax ? money(record.tax) : "Not charged"],
              ]
            : [
                ["SUBTOTAL", money(record.subtotal)],
                ["DISCOUNT", money(record.discount)],
                ["GST / HST", record.tax ? money(record.tax) : "Not charged"],
              ];
        doc.roundedRect(X, summaryY, W, 48, 4).fill(C.paper);
        values.forEach(([title, value], i) => {
          text(title, 57 + i * 175, summaryY + 9, 155, 7, "Helvetica", C.muted);
          text(
            value,
            57 + i * 175,
            summaryY + 25,
            155,
            10.5,
            "Helvetica-Bold",
            C.navy,
          );
        });
        const amountY = summaryY + 61;
        doc.roundedRect(X, amountY, W, 43, 4).fill(C.light);
        text(
          "AMOUNT DUE NOW",
          57,
          amountY + 16,
          290,
          10,
          "Helvetica-Bold",
          C.green,
        );
        text(
          money(record.total),
          355,
          amountY + 11,
          183,
          19,
          "Helvetica-Bold",
          C.green,
          { align: "right" },
        );
        doc.y = amountY + 59;
        text("Payment Instructions", X, doc.y, W, 11, "Helvetica-Bold");
        doc.y += 10;
        const officialPayment =
          content &&
          globalThis.programmeContent.payment(
            content === globalThis.programmeContent.get("inner-code")
              ? "inner-code"
              : cfg?.id || record.items[0]?.productId,
            record.total / 100,
          );
        const matchesPayment =
          officialPayment &&
          String(record.payment)
            .replace(/^Payment instructions:\s*/i, "")
            .trim() === officialPayment.trim();
        if (matchesPayment) {
          const id = cfg?.id || record.items[0]?.productId;
          if (content.deposit) {
            bullet(
              `Send **CAD ${record.total / 100}** by **Interac e-Transfer** to **seekbyritu@gmail.com**.`,
            );
            bullet(
              `Include your **full name** and **registration email**.${record.total === 15000 ? " The deposit is included in the CAD 500 total." : ""}`,
            );
          } else {
            const y = doc.y;
            bullet(
              `Pay **CAD ${record.total / 100}** securely through **Stripe**.`,
            );
            const url = globalThis.innerCodePayments?.url(
              id,
              record.total / 100,
            );
            if (url) doc.link(59, y, 380, 17, url);
            bullet("Use the same email address as your registration.");
            bullet(
              "Your bank may apply currency conversion or international payment fees.",
            );
            bullet("Payment issue? Email **seekbyritu@gmail.com**.");
          }
        } else if (record.formatting?.payment) rich(record.formatting.payment);
        else
          for (const row of String(
            record.payment ||
              "Payment instructions are required before issuing.",
          ).split("\n"))
            bullet(row);
        if (record.notes) {
          ensure(45);
          if (record.formatting?.notes) rich(record.formatting.notes);
          else body(record.notes);
        }
      }
    }
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      if (kind === "invoice")
        text(
          "Thank you for choosing Seek by Ritu. This invoice is a payment request, not a payment receipt.",
          44,
          780,
          W,
          8,
          "Helvetica",
          C.ink,
          { lineBreak: false },
        );
      if (kind === "receipt")
        text(
          "This receipt records a payment verified by Rituparna.",
          44,
          780,
          W,
          8,
          "Helvetica",
          C.ink,
          { lineBreak: false },
        );
      text(
        "Seek by Ritu  |  Delivered by BLINDSPOT STUDIOS",
        44,
        809,
        420,
        8,
        "Helvetica",
        C.muted,
        { lineBreak: false },
      );
      text(`${i + 1} / ${range.count}`, 500, 809, 51, 8, "Helvetica", C.muted, {
        align: "right",
        lineBreak: false,
      });
    }
    doc.end();
  });
}
