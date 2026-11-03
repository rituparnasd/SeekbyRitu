import test from "node:test";
import assert from "node:assert/strict";
import PDFDocument from "pdfkit";
import { registerFonts } from "../lib/brand.mjs";
import { formattedLayout, drawFormattedText } from "../lib/formatted-text.mjs";
test("rich PDF lines retain all text and styles while wrapping oversized words within their bounds", () => {
  const doc = registerFonts(new PDFDocument({ margin: 0 }));
  const text = "Formatting " + "LongWord".repeat(40);
  const delta = {
    ops: [
      {
        insert: text,
        attributes: {
          bold: true,
          italic: true,
          color: "#175cd3",
          background: "#fff3a3",
          size: "24pt",
        },
      },
      { insert: "\n", attributes: { align: "justify", lineheight: "2" } },
    ],
  };
  const blocks = formattedLayout(doc, delta, { width: 200 });
  assert.equal(
    blocks[0].lines
      .flatMap((l) => l.tokens.map((t) => t.text))
      .join("")
      .replace(/\s/g, ""),
    text.replace(/\s/g, ""),
  );
  for (const line of blocks[0].lines) {
    assert(line.width <= 200.001);
    assert.equal(line.height, 48);
  }
  assert.equal(blocks[0].align, "justify");
  assert.equal(blocks[0].lines[0].tokens[0].font, "BrandBold");
  assert.equal(blocks[0].lines[0].tokens[0].italic, true);
  assert.equal(blocks[0].lines[0].tokens[0].color, "#175cd3");
  doc.end();
});
test("rich PDF alignment and page breaks respect the available drawing area", () => {
  const doc = registerFonts(new PDFDocument({ margin: 0 }));
  const draws = [];
  let pages = 1;
  const actual = doc.text.bind(doc);
  doc.text = (text, x, y, options) => {
    draws.push({ text, x, y, font: doc._font.name, size: doc._fontSize });
    return actual(text, x, y, options);
  };
  doc.y = 100;
  const delta = {
    ops: [
      { insert: "Right aligned", attributes: { size: "14pt" } },
      { insert: "\n", attributes: { align: "right" } },
      {
        insert: "one two three four five six seven eight nine ten ".repeat(12),
        attributes: { italic: true },
      },
      { insert: "\n", attributes: { align: "justify" } },
    ],
  };
  drawFormattedText(doc, delta, {
    x: 40,
    width: 200,
    bottom: 230,
    newPage: () => {
      doc.addPage();
      pages++;
      doc.y = 80;
    },
  });
  assert(pages > 1);
  assert(draws.every((d) => d.x >= 40 && d.x < 240 && d.y >= 80 && d.y < 230));
  const first = draws[0];
  assert(first.x > 40);
  doc.end();
});
