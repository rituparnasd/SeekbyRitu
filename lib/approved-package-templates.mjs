import { initialProducts } from "./billing.mjs";
import { packageTerms } from "./package-terms.mjs";
import "../public/programme-content.js";
const marker = "owner_approved_package_templates_2026_11_03";
export async function adoptApprovedPackageTemplates(db, crypt) {
  return db.transaction(async () => {
    if (
      (await db.query("SELECT value FROM metadata WHERE name=?", [marker]))[0]
    )
      return;
    for (const base of initialProducts(packageTerms("inner-code"))) {
      const rows = await db.query(
        "SELECT payload FROM documents WHERE section='billing_catalogue' AND record_key=?",
        [base.id],
      );
      const old = rows[0] ? crypt.open(rows[0].payload) : null;
      if (old)
        await db.query(
          "INSERT INTO documents(section,record_key,payload) VALUES('billing_catalogue_history',?,?) ON CONFLICT(section,record_key) DO NOTHING",
          [base.id + ":" + old.version, rows[0].payload],
        );
      const value = {
        ...base,
        ...old,
        name: globalThis.programmeContent.get(base.id).label,
        price: base.price,
        currency: "CAD",
        tax: 0,
        description: globalThis.programmeContent.description(base.id),
        requiresAgreement: true,
        nextSteps: globalThis.programmeContent.nextText(base.id),
        terms: packageTerms(base.id),
        formatting: {
          ...old?.formatting,
          description: globalThis.programmeContent.descriptionDelta(base.id),
          terms: globalThis.programmeContent.delta(base.id),
        },
        approved: true,
        version: (old?.version || 0) + 1,
        updatedAt: new Date().toISOString(),
        templateVersion: "owner-2026-11-03",
      };
      await db.query(
        "INSERT INTO documents(section,record_key,payload) VALUES('billing_catalogue',?,?) ON CONFLICT(section,record_key) DO UPDATE SET payload=excluded.payload",
        [base.id, crypt.seal(value)],
      );
    }
    await db.query("INSERT INTO metadata(name,value) VALUES(?,?)", [
      marker,
      new Date().toISOString(),
    ]);
  });
}
