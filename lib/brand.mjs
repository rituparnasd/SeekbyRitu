import { fileURLToPath } from "node:url";
export const colours = {
  navy: "#071a2b",
  green: "#0b3027",
  sage: "#dce7e0",
  paper: "#f7f9f8",
  ink: "#172b29",
  muted: "#687772",
  line: "#dce3dd",
};
export const logo = fileURLToPath(
  new URL("../public/assets/seekbyritu-logo.png", import.meta.url),
);
export function registerFonts(doc) {
  doc.registerFont(
    "BrandSerif",
    fileURLToPath(
      new URL("../public/assets/fonts/NotoSerif-Regular.ttf", import.meta.url),
    ),
  );
  doc.registerFont(
    "BrandSans",
    fileURLToPath(
      new URL("../public/assets/fonts/OpenSans-Regular.ttf", import.meta.url),
    ),
  );
  doc.registerFont(
    "BrandBold",
    fileURLToPath(
      new URL("../public/assets/fonts/OpenSans-Semibold.ttf", import.meta.url),
    ),
  );
  return doc;
}
export function pageHeader(doc, { number = 1, label = "WORKING DRAFT" } = {}) {
  registerFonts(doc);
  doc.rect(0, 0, 595.28, 10).fill(colours.green);
  doc.image(logo, 44, 28, { fit: [48, 61] });
  doc
    .font("BrandSerif")
    .fontSize(24)
    .fillColor(colours.navy)
    .text("Seek by Ritu", 112, 35);
  doc
    .font("BrandSans")
    .fontSize(8)
    .fillColor(colours.green)
    .text("INNER CODE", 113, 66);
  doc
    .fontSize(8)
    .fillColor(colours.muted)
    .text("Rituparna Das  |  seekbyritu@gmail.com", 300, 42, {
      width: 250,
      align: "right",
    })
    .text(label, 300, 61, { width: 250, align: "right" });
  doc.moveTo(44, 106).lineTo(551, 106).strokeColor(colours.line).stroke();
  doc
    .font("BrandSans")
    .fontSize(7)
    .fillColor(colours.muted)
    .text("INNER CODE  |  Delivered by BLINDSPOT STUDIOS", 44, 778, {
      width: 420,
      lineBreak: false,
    })
    .text(String(number), 520, 778, {
      width: 30,
      align: "right",
      lineBreak: false,
    });
  doc.y = 126;
}
export function documentTitle(doc, title, subtitle) {
  doc
    .font("BrandSerif")
    .fontSize(31)
    .fillColor(colours.navy)
    .text(title, 44, 127, { width: 507 });
  doc
    .font("BrandSans")
    .fontSize(9)
    .fillColor(colours.muted)
    .text(subtitle, 45, 168, { width: 505 });
  doc.y = 197;
}
export function clause(doc, label, text, { size = 8.7, gap = 6 } = {}) {
  const y = doc.y;
  doc
    .font("BrandBold")
    .fontSize(7.5)
    .fillColor(colours.green)
    .text(label.toUpperCase(), 44, y, { width: 507 });
  doc
    .font("BrandSans")
    .fontSize(size)
    .fillColor(colours.ink)
    .text(text, 44, y + 13, { width: 507, lineGap: 1.4 });
  doc.y += gap;
}
export function amountBand(doc, items, y = 200) {
  const w = 507 / items.length;
  doc.roundedRect(44, y, 507, 66, 5).fill(colours.paper);
  items.forEach(([label, value], i) => {
    doc
      .font("BrandSans")
      .fontSize(7.5)
      .fillColor(colours.muted)
      .text(label.toUpperCase(), 58 + i * w, y + 12, { width: w - 28 });
    doc
      .font("BrandSerif")
      .fontSize(24)
      .fillColor(colours.green)
      .text(value, 58 + i * w, y + 29, { width: w - 28 });
  });
  doc.y = y + 84;
}
export function draftNotice(doc, text, y) {
  const height =
    doc
      .font("BrandSans")
      .fontSize(8)
      .heightOfString(text, { width: 477, lineGap: 2 }) + 25;
  doc.roundedRect(44, y, 507, height, 4).fill("#f0eee7");
  doc
    .font("BrandSans")
    .fontSize(8)
    .fillColor("#625846")
    .text(text, 59, y + 12, { width: 477, lineGap: 2 });
  doc.y = y + height + 12;
}
