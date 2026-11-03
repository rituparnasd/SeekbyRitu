import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { database } from "../lib/database.mjs";
import { encryption } from "../lib/security.mjs";
import { adoptApprovedPackageTemplates } from "../lib/approved-package-templates.mjs";
import "../public/document-format.js";
test("owner-approved templates are adopted once; previous defaults and issued records remain preserved", async () => {
  const dir = await mkdtemp(join(tmpdir(), "seek-approved-"));
  process.env.NODE_ENV = "test";
  process.env.TEST_DB_PATH = join(dir, "db");
  delete process.env.DATABASE_URL;
  const db = await database(),
    crypt = encryption(randomBytes(32).toString("base64"));
  try {
    await db.query(
      "INSERT INTO documents(section,record_key,payload) VALUES('billing_catalogue','inner-code',?)",
      [
        crypt.seal({
          id: "inner-code",
          version: 7,
          name: "Old",
          terms: "Old terms",
          price: 500,
        }),
      ],
    );
    const frozen = crypt.seal({
      status: "Issued",
      terms: "Previously agreed terms",
      reference: "OLD",
    });
    await db.query(
      "INSERT INTO documents(section,record_key,payload) VALUES('billing_documents','old-invoice',?)",
      [frozen],
    );
    await adoptApprovedPackageTemplates(db, crypt);
    const rows = await db.query(
      "SELECT record_key,payload FROM documents WHERE section='billing_catalogue'",
    );
    assert.equal(rows.length, 3);
    for (const row of rows) {
      const p = crypt.open(row.payload);
      assert(p.approved);
      assert.equal(p.terms, globalThis.programmeContent.terms(p.id));
      assert.doesNotThrow(() =>
        globalThis.documentFormat.normalize(p.formatting.terms, p.terms),
      );
      assert.match(p.nextSteps, /What Happens Next/);
    }
    assert.equal(
      (
        await db.query(
          "SELECT payload FROM documents WHERE record_key='old-invoice'",
        )
      )[0].payload,
      frozen,
    );
    assert.equal(
      (
        await db.query(
          "SELECT payload FROM documents WHERE section='billing_catalogue_history' AND record_key='inner-code:7'",
        )
      ).length,
      1,
    );
    const custom = {
      ...crypt.open(rows[0].payload),
      terms: "A later coach edit",
    };
    await db.query(
      "UPDATE documents SET payload=? WHERE section='billing_catalogue' AND record_key=?",
      [crypt.seal(custom), custom.id],
    );
    await adoptApprovedPackageTemplates(db, crypt);
    assert.equal(
      crypt.open(
        (
          await db.query(
            "SELECT payload FROM documents WHERE section='billing_catalogue' AND record_key=?",
            [custom.id],
          )
        )[0].payload,
      ).terms,
      "A later coach edit",
    );
  } finally {
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
