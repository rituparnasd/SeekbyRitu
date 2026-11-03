import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { database } from "../lib/database.mjs";
import { encryption } from "../lib/security.mjs";
import {
  deleteBillingDocument,
  restoreBillingDraft,
  removeRequestedMistakenInvoice,
} from "../lib/billing-deletion.mjs";
test("draft deletion is restorable; mistaken unpaid issued deletion is permanent and preserves actual payments", async () => {
  const dir = await mkdtemp(join(tmpdir(), "seek-delete-"));
  process.env.NODE_ENV = "test";
  process.env.TEST_DB_PATH = join(dir, "db");
  delete process.env.DATABASE_URL;
  const db = await database(),
    crypt = encryption(randomBytes(32).toString("base64"));
  const put = (section, id, value) =>
    db.query(
      "INSERT INTO documents(section,record_key,payload) VALUES(?,?,?)",
      [section, id, crypt.seal(value)],
    );
  const get = async (section, id) =>
    (
      await db.query(
        "SELECT payload FROM documents WHERE section=? AND record_key=?",
        [section, id],
      )
    )[0];
  try {
    for (const [id, status] of [
      ["draft", "Draft"],
      ["issued", "Issued"],
      ["paid", "Issued"],
      ["uncertain", "Issued"],
    ])
      await put("billing_documents", id, {
        id,
        status,
        version: 2,
        reference: status === "Issued" ? "REF-" + id : undefined,
        total: 5000,
        currency: "CAD",
      });
    await put("billing_payments", "receipt", {
      id: "receipt",
      invoiceId: "paid",
      receipt: { amount: 5000 },
    });
    await put("outbox", "mail", { documentId: "issued", status: "Draft" });
    await db.query("INSERT INTO deliveries(id,payload) VALUES(?,?)", [
      "mail",
      crypt.seal({ status: "Failed" }),
    ]);
    await put("outbox", "uncertain-mail", {
      documentId: "uncertain",
      status: "Unknown",
    });
    await db.query("INSERT INTO deliveries(id,payload) VALUES(?,?)", [
      "uncertain-mail",
      crypt.seal({ status: "Unknown" }),
    ]);
    await db.transaction(() =>
      deleteBillingDocument(db, crypt, { id: "draft", version: 2 }),
    );
    assert(!(await get("billing_documents", "draft")));
    const trash = crypt.open((await get("billing_trash", "draft")).payload);
    assert.equal(trash.version, 3);
    await db.transaction(() =>
      restoreBillingDraft(db, crypt, { id: "draft", version: trash.version }),
    );
    assert(await get("billing_documents", "draft"));
    assert(!(await get("billing_trash", "draft")));
    await assert.rejects(
      db.transaction(() =>
        deleteBillingDocument(db, crypt, {
          id: "issued",
          version: 1,
          confirm: true,
        }),
      ),
      /changed/,
    );
    await assert.rejects(
      db.transaction(() =>
        deleteBillingDocument(db, crypt, { id: "issued", version: 2 }),
      ),
      /Confirm/,
    );
    await db.transaction(() =>
      deleteBillingDocument(db, crypt, {
        id: "issued",
        version: 2,
        confirm: true,
      }),
    );
    assert(!(await get("billing_documents", "issued")));
    assert(!(await get("billing_trash", "issued")));
    assert(!(await get("outbox", "mail")));
    assert.equal(
      (await db.query("SELECT * FROM deliveries WHERE id=?", ["mail"])).length,
      0,
    );
    await assert.rejects(
      db.transaction(() =>
        deleteBillingDocument(db, crypt, {
          id: "paid",
          version: 2,
          confirm: true,
        }),
      ),
      /payment or receipt/,
    );
    assert(await get("billing_documents", "paid"));
    assert(await get("billing_payments", "receipt"));
    await assert.rejects(
      db.transaction(() =>
        deleteBillingDocument(db, crypt, {
          id: "uncertain",
          version: 2,
          confirm: true,
        }),
      ),
      /pending or uncertain/,
    );
    assert(await get("billing_documents", "uncertain"));
  } finally {
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("the owner-specified incorrect invoice is removed once without touching another invoice or client", async () => {
  const dir = await mkdtemp(join(tmpdir(), "seek-specific-delete-"));
  process.env.NODE_ENV = "test";
  process.env.TEST_DB_PATH = join(dir, "db");
  delete process.env.DATABASE_URL;
  const db = await database(),
    crypt = encryption(randomBytes(32).toString("base64"));
  try {
    for (const [id, reference] of [
      ["target", "IC-IS-SQEWVA-JWUWQY"],
      ["keep", "IC-IS-ABCDEF-GHJKLM"],
    ])
      await db.query(
        "INSERT INTO documents(section,record_key,payload) VALUES('billing_documents',?,?)",
        [
          id,
          crypt.seal({
            id,
            reference,
            status: "Issued",
            currency: "CAD",
            total: 5000,
            version: 2,
          }),
        ],
      );
    const result = await removeRequestedMistakenInvoice(db, crypt);
    assert(result.removed);
    assert.equal(
      (
        await db.query(
          "SELECT * FROM documents WHERE section='billing_documents' AND record_key='target'",
        )
      ).length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "SELECT * FROM documents WHERE section='billing_documents' AND record_key='keep'",
        )
      ).length,
      1,
    );
    assert.deepEqual(await removeRequestedMistakenInvoice(db, crypt), result);
  } finally {
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
