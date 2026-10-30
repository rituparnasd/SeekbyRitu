import PDFDocument from "pdfkit";
import { registerFonts, logo } from "./brand.mjs";
export function reportData(s, id, endDay) {
  const p = s.programmes[id],
    plans = (s.customPlans[id] || []).map(
      (h, i) => s.localizedEdits?.[id]?.en?.[i] || h,
    ),
    end = new Date(p.start + "T12:00:00Z");
  end.setUTCDate(end.getUTCDate() + endDay - 1);
  const endDate = end.toISOString().slice(0, 10);
  const startDay = endDay === 30 ? 1 : Math.max(1, endDay - 6);
  const start = new Date(p.start + "T12:00:00Z");
  start.setUTCDate(start.getUTCDate() + startDay - 1);
  const startDate = start.toISOString().slice(0, 10);
  const rows = Object.entries(s.records).filter(
    ([k]) =>
      k.startsWith(id + ":") &&
      k.split(":")[1] >= startDate &&
      k.split(":")[1] <= endDate,
  );
  const pillars = [
    "Health",
    "Relationships",
    "Career",
    "Money",
    "Spirituality",
  ].map((name) => {
    const indices = plans
        .map((h, i) => (h[0] === name ? i : -1))
        .filter((i) => i >= 0),
      possible = indices.length * (endDay - startDay + 1);
    let done = 0,
      adapted = 0,
      rest = 0;
    for (const [, v] of rows)
      for (const i of indices) {
        if (v[i] === "done") done++;
        if (v[i] === "adapted") adapted++;
        if (v[i] === "rest") rest++;
      }
    return {
      name,
      done,
      adapted,
      rest,
      possible,
      score: possible ? Math.round((done / possible) * 100) : null,
    };
  });
  return {
    startDate,
    endDate,
    endDay,
    recordedDays: rows.length,
    totalDays: endDay - startDay + 1,
    pillars,
    created: new Date().toISOString(),
  };
}
export function reportPDF(client, data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 45 }),
      chunks = [];
    doc.on("data", (c) => chunks.push(c));
    registerFonts(doc);
    doc.font("BrandSans");
    doc.image(logo, 475, 35, { fit: [40, 50] });
    doc.y = 45;
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc
      .fillColor("#0b3027")
      .fontSize(27)
      .text("Seek by Ritu")
      .fontSize(20)
      .text("Your Progress, Made Visible")
      .moveDown(0.5)
      .fontSize(12)
      .fillColor("#172b29")
      .text(client)
      .text(data.startDate + " — " + data.endDate)
      .moveDown()
      .text(`Recorded days: ${data.recordedDays} / ${data.totalDays}`)
      .moveDown();
    for (const p of data.pillars) {
      const y = doc.y;
      doc
        .fontSize(15)
        .text(
          p.name +
            "   " +
            (p.score === null ? "No assigned actions" : p.score + "%"),
        );
      doc.roundedRect(45, y + 27, 480, 10, 4).fill("#dce7e0");
      if (p.score)
        doc
          .roundedRect(45, y + 27, Math.max(8, (480 * p.score) / 100), 10, 4)
          .fill("#0b3027");
      doc
        .fillColor("#172b29")
        .fontSize(10)
        .text(
          `${p.done} completed · ${p.adapted} adapted · ${p.rest} rest/recovery · ${p.possible} planned slots`,
          45,
          y + 46,
        );
      doc.y = y + 85;
    }
    doc
      .fontSize(10)
      .text(
        "Coverage and missing days are shown explicitly. Adaptation/rest are separate from completion. These scores are recorded action counts, not clinical or spiritual measurements. No automatic passing/refund decision is made. Historical assignment versioning is not yet available; coach review is required if the plan changed during this period.",
        45,
        doc.y,
        { width: 480 },
      );
    doc.end();
  });
}
