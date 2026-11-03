import "../public/packages.js";
export const americanEnglish = globalThis.americanEnglish;
const marker = "owner_american_english_2026_11_03";
const fields = new Set([
  "name",
  "description",
  "terms",
  "nextSteps",
  "payment",
  "notes",
  "subject",
  "body",
  "insert",
]);
function copy(value, key) {
  if (typeof value === "string")
    return fields.has(key) ? americanEnglish(value) : value;
  if (Array.isArray(value)) return value.map((item) => copy(item));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, copy(v, k)]),
    );
  return value;
}
export async function adoptAmericanEnglish(db, crypt) {
  return db.transaction(async () => {
    if (
      (await db.query("SELECT value FROM metadata WHERE name=?", [marker]))[0]
    )
      return;
    for (const section of [
      "billing_catalogue",
      "billing_documents",
      "outbox",
    ]) {
      const rows = await db.query(
        "SELECT record_key,payload FROM documents WHERE section=?",
        [section],
      );
      for (const row of rows) {
        const old = crypt.open(row.payload);
        if (section !== "billing_catalogue" && old.status !== "Draft") continue;
        // Customer identities and signed acknowledgments are not language templates.
        const updated = { ...old };
        for (const key of [
          "name",
          "description",
          "terms",
          "nextSteps",
          "payment",
          "notes",
          "subject",
          "body",
          "formatting",
          "items",
        ]) {
          if (old[key] !== undefined) updated[key] = copy(old[key], key);
        }
        if (JSON.stringify(updated) === JSON.stringify(old)) continue;
        await db.query(
          "INSERT INTO documents(section,record_key,payload) VALUES(?,?,?) ON CONFLICT(section,record_key) DO NOTHING",
          [
            section + "_language_history",
            row.record_key + ":" + (old.version || "original"),
            row.payload,
          ],
        );
        if (old.version !== undefined) updated.version = old.version + 1;
        updated.updatedAt = new Date().toISOString();
        await db.query(
          "UPDATE documents SET payload=? WHERE section=? AND record_key=?",
          [crypt.seal(updated), section, row.record_key],
        );
      }
    }
    await db.query("INSERT INTO metadata(name,value) VALUES(?,?)", [
      marker,
      new Date().toISOString(),
    ]);
  });
}
