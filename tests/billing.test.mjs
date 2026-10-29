import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { database } from "../lib/database.mjs";
import { encryption } from "../lib/security.mjs";
import { billingStore, documentInput, billingPDF } from "../lib/billing.mjs";

test("catalogue snapshots, integer money, issue/revision immutability and persistence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "seek-billing-"));
  process.env.NODE_ENV = "test";
  process.env.TEST_DB_PATH = join(dir, "billing.db");
  delete process.env.DATABASE_URL;
  let db = await database();
  const crypt = encryption(randomBytes(32).toString("base64"));
  const business = {
    name: "Fixture Studio",
    address: "Fixture address",
    currency: "CAD",
  };
  try {
    let store = billingStore(db, crypt, "Draft terms");
    const p = await store.saveProduct({
      name: "Workshop",
      kind: "Service",
      price: 19.99,
      currency: "CAD",
      tax: 5,
      terms:
        "One workshop. Payment due before attendance. Cancellation accepted until seven days before the event.",
      approved: true,
    });
    const request = {
      customer: { name: "Fixture Customer", email: "customer@example.test" },
      due: "2026-12-01",
      items: [
        {
          productId: p.id,
          name: p.name,
          description: p.description,
          quantity: 3,
          price: 19.99,
          discount: 1,
          tax: 5,
        },
      ],
      terms: p.terms,
      approved: true,
      payment: "Pay using the agreed test payment method.",
      notes: "",
    };
    const d = await store.saveDocument(request, business);
    assert.equal(d.subtotal, 5997);
    assert.equal(d.discount, 100);
    assert.equal(d.tax, 295);
    assert.equal(d.total, 6192);
    await assert.rejects(() => store.issue(d.id, d.version - 1), /changed/);
    const issued = await db.transaction(() => store.issue(d.id, d.version));
    assert.match(issued.reference, /^SBR-\d{4}-00001$/);
    await assert.rejects(
      () =>
        store.saveDocument({ ...request, id: d.id, version: issued.version }),
      /frozen/,
    );
    await store.saveProduct({ ...p, price: 40, terms: "New workshop terms." });
    const frozen = (await store.documents())[0];
    assert.equal(frozen.items[0].unit, 1999);
    assert.equal(frozen.terms, p.terms);
    await assert.rejects(
      () => store.saveProduct({ ...p, price: 60 }),
      /another device/,
    );
    const revision = await store.revise(issued.id);
    assert.equal(revision.revises, issued.reference);
    assert.equal(revision.approved, false);
    assert.notEqual(revision.id, issued.id);
    const pending = await store.saveDocument(
      { ...request, payment: "", approved: false },
      business,
    );
    await assert.rejects(
      () => store.issue(pending.id, pending.version),
      /approve/,
    );
    assert.throws(
      () =>
        documentInput(
          { ...request, items: [{ ...request.items[0], quantity: -1 }] },
          [p],
          business,
        ),
      /quantity/,
    );
    const other = await store.saveProduct({
      ...p,
      id: undefined,
      version: undefined,
      name: "Other currency",
      currency: "USD",
    });
    assert.throws(
      () =>
        documentInput(
          {
            ...request,
            items: [
              ...request.items,
              { ...request.items[0], productId: other.id },
            ],
          },
          [p, other],
          business,
        ),
      /same currency/,
    );
    const invoice = await billingPDF(issued, "invoice");
    assert.equal(invoice.subarray(0, 4).toString(), "%PDF");
    const agreement = await billingPDF(
      { ...issued, terms: "Test agreement paragraph.\n\n".repeat(500) },
      "agreement",
    );
    assert(
      (agreement.toString("latin1").match(/\/Type \/Page\b/g) || []).length > 1,
    );
    await db.close();
    db = await database();
    store = billingStore(db, crypt, "Draft terms");
    assert.equal(
      (await store.documents()).find((d) => d.id === issued.id).total,
      6192,
    );
    assert.equal((await store.products()).find((v) => v.id === p.id).price, 40);
  } finally {
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
