import "../public/document-format.js";
import { colours } from "./brand.mjs";
function style(run, attributes, defaultSize, defaultFont) {
  const originalSize = run.size
    ? Number.parseFloat(run.size)
    : attributes.header
      ? [0, 22, 16.5, 12.87][attributes.header]
      : 11;
  const size = run.script ? originalSize * 0.7 : originalSize;
  const bold = run.bold || attributes.header || defaultFont === "BrandBold";
  const font =
    run.font === "monospace"
      ? bold
        ? "Courier-Bold"
        : "Courier"
      : run.font === "times"
        ? bold
          ? "Times-Bold"
          : "Times-Roman"
        : run.font === "serif"
          ? "BrandSerif"
          : run.font === "helvetica"
            ? bold
              ? "Helvetica-Bold"
              : "Helvetica"
            : bold
              ? "BrandBold"
              : "BrandSans";
  return {
    size,
    originalSize,
    font,
    italic: !!run.italic,
    underline: !!run.underline,
    strike: !!run.strike,
    color: run.color,
    background: run.background,
    offset:
      run.script === "sub"
        ? originalSize * 0.25
        : run.script === "super"
          ? -originalSize * 0.25
          : 0,
    stroke: run.font === "serif" && !!bold,
  };
}
export function formattedLayout(
  doc,
  delta,
  { width = 507, defaultSize = 10, defaultFont = "BrandSans" } = {},
) {
  let count = 0;
  return globalThis.documentFormat.paragraphs(delta).map((p) => {
    if (p.attributes.list === "ordered") count++;
    else count = 0;
    const marker =
      p.attributes.list === "ordered"
        ? `${count}.`
        : p.attributes.list === "bullet"
          ? "•"
          : "";
    const indent = (p.attributes.indent || 0) * 15 + (marker ? 18 : 0),
      available = Math.max(40, width - indent);
    const lines = [];
    let tokens = [],
      used = 0;
    const emit = () => {
      while (tokens.at(-1)?.space) {
        used -= tokens.pop().width;
      }
      lines.push({
        tokens,
        width: used,
        height:
          Math.max(defaultSize, ...tokens.map((t) => t.originalSize)) *
          Number(p.attributes.lineheight || 1.5),
      });
      tokens = [];
      used = 0;
    };
    for (const run of p.runs) {
      const st = style(run, p.attributes, defaultSize, defaultFont);
      for (const text of run.text.match(/\s+|\S+/g) || []) {
        const space = /^\s+$/.test(text),
          value = space ? " " : text;
        doc.font(st.font).fontSize(st.size);
        const w = doc.widthOfString(value);
        if (used + w > available && tokens.length) emit();
        if (space && !tokens.length) continue;
        if (w > available) {
          for (const char of value) {
            const cw = doc.widthOfString(char);
            if (used + cw > available && tokens.length) emit();
            tokens.push({ text: char, width: cw, ...st, space: false });
            used += cw;
          }
        } else {
          tokens.push({ text: value, width: w, ...st, space });
          used += w;
        }
      }
    }
    if (tokens.length || !lines.length) emit();
    return {
      lines,
      marker,
      indent,
      available,
      align: p.attributes.align || "left",
    };
  });
}
export function formattedHeight(doc, delta, options = {}) {
  return formattedLayout(doc, delta, options).reduce(
    (height, p) => height + p.lines.reduce((n, l) => n + l.height, 0) + 5,
    0,
  );
}
export function drawFormattedText(
  doc,
  delta,
  {
    x = 44,
    width = 507,
    defaultSize = 10,
    defaultFont = "BrandSans",
    bottom = 752,
    newPage = () => doc.addPage(),
    colour = colours.ink,
  } = {},
) {
  const paragraphs = formattedLayout(doc, delta, {
    width,
    defaultSize,
    defaultFont,
  });
  for (const p of paragraphs) {
    for (let index = 0; index < p.lines.length; index++) {
      const line = p.lines[index];
      if (doc.y + line.height > bottom) newPage();
      const y = doc.y;
      if (index === 0 && p.marker)
        doc
          .font("BrandSans")
          .fontSize(defaultSize)
          .fillColor(colour)
          .text(p.marker, x + p.indent - 18, y, { lineBreak: false });
      let cursor =
        x +
        p.indent +
        (p.align === "right"
          ? p.available - line.width
          : p.align === "center"
            ? (p.available - line.width) / 2
            : 0);
      const spaces = line.tokens.filter((t) => t.space).length;
      const extra =
        p.align === "justify" && index < p.lines.length - 1 && spaces
          ? (p.available - line.width) / spaces
          : 0;
      for (const token of line.tokens) {
        if (token.background)
          doc
            .rect(
              cursor,
              y,
              token.width + (token.space ? extra : 0),
              line.height,
            )
            .fill(token.background);
        if (!token.space)
          doc
            .font(token.font)
            .fontSize(token.size)
            .fillColor(token.color || colour)
            .strokeColor(token.color || colour)
            .lineWidth(0.2)
            .text(token.text, cursor, y + token.offset, {
              lineBreak: false,
              oblique: token.italic,
              underline: token.underline,
              strike: token.strike,
              stroke: token.stroke,
              fill: true,
            });
        cursor += token.width + (token.space ? extra : 0);
      }
      doc.y = y + line.height;
    }
    doc.y += 5;
  }
  return doc.y;
}
