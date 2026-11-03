import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { database } from "../lib/database.mjs";
import { encryption } from "../lib/security.mjs";
import { removeRequestedDrafts } from "../lib/billing-draft-cleanup.mjs";
test("owner-requested draft cleanup is one-time and preserves issued records, payments, catalogue and newer drafts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "seek-draft-cleanup-"));
  process.env.NODE_ENV = "test";
  process.env.TEST_DB_PATH = join(dir, "data.db");
  delete process.env.DATABASE_URL;
  const db = await database(),
    crypt = encryption(randomBytes(32).toString("base64"));
  try {
    for (const [id, status, updatedAt] of [
      ["old", "Draft", "2026-11-01T00:00:00Z"],
      ["issued", "Issued", "2026-11-01T00:00:00Z"],
      ["new", "Draft", "2026-11-04T00:00:00Z"],
      ["paid", "Draft", "2026-11-01T00:00:00Z"],
    ])
      await db.query(
        "INSERT INTO documents(section,record_key,payload) VALUES(?,?,?)",
        ["billing_documents", id, crypt.seal({ id, status, updatedAt })],
      );
    for (const [section, key, value] of [
      ["billing_payments", "receipt", { invoiceId: "paid" }],
      ["billing_catalogue", "product", { name: "Keep" }],
    ])
      await db.query(
        "INSERT INTO documents(section,record_key,payload) VALUES(?,?,?)",
        [section, key, crypt.seal(value)],
      );
    const result = await removeRequestedDrafts(db, crypt);
    assert.equal(result.removed, 1);
    assert.deepEqual(
      (
        await db.query(
          "SELECT record_key FROM documents WHERE section='billing_documents' ORDER BY record_key",
        )
      ).map((r) => r.record_key),
      ["issued", "new", "paid"],
    );
    await db.query(
      "INSERT INTO documents(section,record_key,payload) VALUES(?,?,?)",
      [
        "billing_documents",
        "later",
        crypt.seal({ id: "later", status: "Draft" }),
      ],
    );
    assert.deepEqual(await removeRequestedDrafts(db, crypt), result);
    assert.equal(
      (await db.query("SELECT * FROM documents WHERE record_key='later'"))
        .length,
      1,
    );
    assert.equal(
      (
        await db.query(
          "SELECT * FROM documents WHERE section='billing_payments'",
        )
      ).length,
      1,
    );
    assert.equal(
      (
        await db.query(
          "SELECT * FROM documents WHERE section='billing_catalogue'",
        )
      ).length,
      1,
    );
  } finally {
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
