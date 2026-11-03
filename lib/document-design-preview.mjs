/* Isolated visual preview. Not used by issued CRM documents. */
import PDFDocument from "pdfkit";
import { colours as c, logo, registerFonts } from "./brand.mjs";
const LEFT = 48,
  WIDTH = 499,
  BOTTOM = 757;
export function designedDocument(record, kind) {
  return new Promise((resolve, reject) => {
    const doc = registerFonts(
      new PDFDocument({ size: "A4", margin: 0, bufferPages: true }),
    );
    const chunks = [];
    doc.on("data", (b) => chunks.push(b));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const money = (n) =>
      `${record.currency || "CAD"} ${Number(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const txt = (
      text,
      x,
      y,
      width,
      size = 10,
      font = "BrandSans",
      colour = c.ink,
      extra = {},
    ) => {
      doc
        .font(font)
        .fontSize(size)
        .fillColor(colour)
        .text(String(text), x, y, { width, lineGap: 2, ...extra });
      return doc.y;
    };
    const label = (text, x, y, width = WIDTH, colour = c.green) =>
      txt(text.toUpperCase(), x, y, width, 7.8, "BrandBold", colour, {
        characterSpacing: 1.2,
      });
    const rule = (y, x = LEFT, width = WIDTH) =>
      doc
        .moveTo(x, y)
        .lineTo(x + width, y)
        .strokeColor(c.line)
        .lineWidth(0.65)
        .stroke();
    let page = 0,
      y = 0;
    const newPage = () => {
      if (page) doc.addPage();
      page++;
      if (page === 1) {
        doc.image(logo, LEFT, 34, { fit: [34, 45] });
        txt("seekbyritu", 94, 37, 220, 22, "BrandSerif", c.navy);
        label("Conscious action. Real life.", 95, 69, 270);
        label("Document preview", 368, 43, 179, c.muted);
        txt("DRAFT · NOT ISSUED", 368, 61, 179, 8, "BrandSans", c.muted, {
          align: "right",
        });
        rule(97);
        y = 118;
      } else {
        txt("Seek by Ritu", LEFT, 33, 210, 16, "BrandSerif", c.navy);
        label(
          kind === "agreement"
            ? "Service Agreement · Continued"
            : "Invoice · Continued",
          280,
          39,
          267,
          c.muted,
        );
        rule(62);
        y = 82;
      }
    };
    const ensure = (h) => {
      if (y + h > BOTTOM) newPage();
    };
    const wrapped = (s, width, size = 10.2, font = "BrandSans") => {
      doc.font(font).fontSize(size);
      const result = [];
      for (const raw of String(s).split("\n")) {
        let line = "";
        for (const word of raw.trim().split(/\s+/)) {
          if (line && doc.widthOfString(line + " " + word) > width) {
            result.push(line);
            line = "";
          }
          if (doc.widthOfString(word) > width) {
            for (const char of word) {
              if (doc.widthOfString(line + char) > width) {
                result.push(line);
                line = "";
              }
              line += char;
            }
          } else line += (line ? " " : "") + word;
        }
        result.push(line);
      }
      return result;
    };
    const prose = (
      s,
      {
        x = LEFT,
        width = WIDTH,
        size = 10.2,
        leading = 14.3,
        gap = 7,
        font = "BrandSans",
        colour = c.ink,
      } = {},
    ) => {
      for (const line of wrapped(s, width, size, font)) {
        ensure(leading);
        txt(line, x, y, width, size, font, colour, { lineBreak: false });
        y += leading;
      }
      y += gap;
    };
    const section = (number, title) => {
      ensure(58);
      txt(
        String(number).padStart(2, "0"),
        LEFT,
        y + 2,
        28,
        9,
        "BrandBold",
        c.green,
      );
      txt(title, LEFT + 36, y, WIDTH - 36, 13, "BrandSerif", c.navy);
      y += 21;
    };
    const shortDate = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return value || "Not set";
      return new Intl.DateTimeFormat("en-CA", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(value + "T12:00:00Z"));
    };
    newPage();
    txt(
      kind === "agreement" ? "Service Agreement" : "Invoice",
      LEFT,
      y,
      WIDTH,
      32,
      "BrandSerif",
      c.navy,
    );
    y += 43;
    if (kind === "invoice") {
      txt(record.packageName, LEFT, y, WIDTH, 11, "BrandSans", c.green);
      y += 29;
      const bandY = y;
      doc.roundedRect(LEFT, bandY, WIDTH, 79, 5).fill(c.navy);
      label("Amount Due Now", LEFT + 20, bandY + 15, 260, "#dce7e0");
      txt(
        money(record.amount),
        LEFT + 20,
        bandY + 33,
        315,
        33,
        "BrandSerif",
        "#ffffff",
      );
      label("Payment Due", LEFT + 355, bandY + 18, 123, "#dce7e0");
      txt(
        shortDate(record.due),
        LEFT + 355,
        bandY + 38,
        123,
        11,
        "BrandBold",
        "#ffffff",
      );
      y += 98;
      const parties = y;
      label("Prepared For", LEFT, parties, 250);
      label("From", 337, parties, 210);
      const toY = txt(
        record.customer.name,
        LEFT,
        parties + 19,
        267,
        12,
        "BrandBold",
        c.navy,
      );
      const toEnd = txt(
        record.customer.email || "",
        LEFT,
        toY + 4,
        267,
        9.5,
        "BrandSans",
        c.muted,
      );
      const fromEnd = txt(
        `${record.business.name}\nseekbyritu@gmail.com`,
        337,
        parties + 19,
        210,
        9.2,
        "BrandSans",
        c.ink,
      );
      y = Math.max(toEnd, fromEnd) + 12;
      txt(
        `Reference: ${record.reference || "DRAFT"}   ·   Prepared: ${shortDate(record.date)}   ·   Version ${record.version || 1}`,
        LEFT,
        y,
        WIDTH,
        8,
        "BrandSans",
        c.muted,
      );
      y += 23;
      rule(y);
      y += 13;
      label("Service / Description", LEFT, y, 327);
      label("Amount", 426, y, 121);
      y += 22;
      for (const item of record.items) {
        const lines = wrapped(item.description || "", 350, 9.4),
          height = 28 + lines.length * 13 + 13;
        ensure(height + 25);
        const top = y;
        const nameEnd = txt(item.name, LEFT, top, 350, 11, "BrandBold", c.navy);
        txt(money(item.amount), 426, top, 121, 11, "BrandBold", c.navy, {
          align: "right",
        });
        y = nameEnd + 5;
        prose(item.description || "", {
          width: 350,
          size: 9.4,
          leading: 13,
          gap: 5,
          colour: c.muted,
        });
        txt(
          `Quantity ${item.quantity || 1}  ·  Unit ${money(item.unit ?? item.amount)}  ·  Tax ${item.tax || 0}%${item.discount ? "  ·  Discount " + money(item.discount) : ""}`,
          LEFT,
          y,
          WIDTH,
          8,
          "BrandSans",
          c.muted,
        );
        y = doc.y + 10;
        rule(y);
        y += 15;
      }
      if (record.subtotal !== undefined && (record.tax || record.discount)) {
        prose(
          `Subtotal ${money(record.subtotal)} · Discount ${money(record.discount || 0)} · Tax ${money(record.tax || 0)}`,
          { size: 9, gap: 9 },
        );
      }
      if (record.packagePrice && record.packagePrice !== record.amount) {
        ensure(43);
        const rowY = y;
        for (const [i, key, val] of [
          [0, "Programme Total", money(record.packagePrice)],
          [1, "Due Now", money(record.amount)],
          [2, "Later Balance", money(record.packagePrice - record.amount)],
        ]) {
          label(key, LEFT + i * 175, rowY, 149);
          txt(val, LEFT + i * 175, rowY + 16, 149, 12, "BrandBold", c.navy);
        }
        y = rowY + 43;
      }
      ensure(60);
      label("How To Pay", LEFT, y);
      y += 19;
      prose(record.payment, { size: 10, leading: 14.4, gap: 10 });
      if (record.notes) {
        ensure(45);
        label("What Happens Next", LEFT, y);
        y += 19;
        prose(record.notes, {
          size: 9.4,
          leading: 13.5,
          colour: c.muted,
          gap: 8,
        });
      }
      ensure(25);
      prose("Payment request only. A receipt follows verified payment.", {
        size: 8.2,
        leading: 12,
        colour: c.muted,
        gap: 0,
      });
    } else {
      label(record.packageName, LEFT, y, 320);
      txt(
        money(record.packagePrice),
        364,
        y - 4,
        183,
        15,
        "BrandSerif",
        c.navy,
        { align: "right" },
      );
      y += 25;
      txt(
        `Prepared for ${record.customer.name}  ·  ${record.customer.email || ""}`,
        LEFT,
        y,
        WIDTH,
        9.4,
        "BrandSans",
        c.ink,
      );
      y += 22;
      txt(
        `Reference ${record.reference || "DRAFT"}  ·  Prepared ${shortDate(record.date)}  ·  Version ${record.version || 1}`,
        LEFT,
        y,
        WIDTH,
        8,
        "BrandSans",
        c.muted,
      );
      y += 23;
      rule(y);
      y += 14;
      prose(record.intro, {
        size: 9.8,
        leading: 13.4,
        gap: 10,
        colour: c.muted,
      });
      for (const clause of record.sections) {
        const clauseHeight =
          24 +
          clause.paragraphs.reduce(
            (height, paragraph) =>
              height + wrapped(paragraph, WIDTH - 26, 10).length * 13 + 2,
            0,
          );
        if (clauseHeight < BOTTOM - 82 && y + clauseHeight > BOTTOM) newPage();
        section(clause.number, clause.title);
        for (const paragraph of clause.paragraphs) {
          prose(paragraph, {
            x: LEFT + 26,
            width: WIDTH - 26,
            size: 10,
            leading: 13,
            gap: 2,
          });
        }
        y += 3;
      }
      if (record.acknowledgement)
        prose(
          `Acknowledgement: ${record.acknowledgement.name} · ${record.acknowledgement.at}`,
          { size: 9 },
        );
      ensure(94);
      y += 5;
      rule(y);
      y += 17;
      const signY = y;
      for (const [x, labelText, name] of [
        [LEFT, "Client Signature", record.customer.name],
        [313, "Coach Signature", "Rituparna Das"],
      ]) {
        label(labelText, x, signY, 220);
        rule(signY + 37, x, 220);
        txt(name, x, signY + 44, 220, 9.2, "BrandSans", c.ink);
        txt(
          "Date: ____________________",
          x,
          signY + 63,
          220,
          8.5,
          "BrandSans",
          c.muted,
        );
      }
    }
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      rule(786);
      txt(
        "Seek by Ritu  /  BLINDSPOT STUDIOS",
        LEFT,
        798,
        270,
        7.2,
        "BrandSans",
        c.muted,
        { lineBreak: false },
      );
      txt(
        `DESIGN PREVIEW · ${i + 1} / ${range.count}`,
        334,
        798,
        213,
        7.2,
        "BrandSans",
        c.muted,
        { align: "right", lineBreak: false },
      );
    }
    doc.end();
  });
}
