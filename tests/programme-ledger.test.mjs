import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { database } from "../lib/database.mjs";
import { encryption } from "../lib/security.mjs";
import { programmeLedger } from "../lib/programme-ledger.mjs";
import { communicationStore } from "../lib/communications.mjs";
import { deleteBillingDocument } from "../lib/billing-deletion.mjs";
async function fixture(run) {
  const dir = await mkdtemp(join(tmpdir(), "seek-ledger-"));
  process.env.NODE_ENV = "test";
  process.env.TEST_DB_PATH = join(dir, "db");
  delete process.env.DATABASE_URL;
  const db = await database(),
    crypt = encryption(randomBytes(32).toString("base64"));
  const s = {
    leads: [
      { id: "a", first: "Test", last: "Client", email: "a@example.test" },
    ],
    programmes: {
      a: {
        packageId: "inner-code",
        paymentOption: "full",
        full: true,
        deposit: true,
        balance: true,
        status: "Not Activated",
      },
    },
    outbox: {},
    workflow: {},
    intakes: {},
    agreements: {},
  };
  try {
    await run(db, crypt, s);
  } finally {
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
}
const legacy = (kind, stage) => ({
  kind,
  stage,
  reference:
    kind === "receipt" ? "IC-CA-LEGACY-RECEIPT" : "IC-CA-LEGACY-INVOICE",
  client: "Test Client",
  customerEmail: "a@example.test",
  amount: 500,
  date: "2026-11-03",
  business: { name: "Seek by Ritu", currency: "CAD" },
  body:
    kind === "agreement"
      ? "Approved service agreement."
      : "Payment instructions",
  packageSnapshot: globalThis.innerCodePackages.get("inner-code"),
  paymentDetails: {
    date: "2026-11-03",
    method: "Interac",
    reference: "bank-a",
  },
});

test("Client and Billing use one saved invoice and receipt without repeated payment entries", () =>
  fixture(async (db, crypt, s) => {
    const ledger = programmeLedger(db, crypt);
    const clientReceipt = await ledger.resolve(
      s,
      "a",
      "receipt",
      "full",
      legacy,
    );
    const invoices = await ledger.list("billing_documents"),
      payments = await ledger.list("billing_payments");
    assert.equal(invoices.length, 1);
    assert.equal(payments.length, 1);
    assert.deepEqual(
      JSON.parse(JSON.stringify(clientReceipt.billingRecord)),
      payments[0],
    );
    assert.equal(payments[0].invoiceReference, invoices[0].reference);
    assert.equal(payments[0].receipt.amount, 50000);
    assert.equal(invoices[0].terms, "Approved service agreement.");
    assert.equal(invoices[0].items[0].productId, "inner-code");
    const second = await ledger.resolve(s, "a", "receipt", "full", () =>
      assert.fail("A saved receipt must be reused"),
    );
    assert.equal(second.reference, clientReceipt.reference);
    assert.equal((await ledger.list("billing_payments")).length, 1);
  }));

test("Billing verification updates Client payment flags; historical conflicts are reported without rewriting records", () =>
  fixture(async (db, crypt, s) => {
    const ledger = programmeLedger(db, crypt);
    const invoice = {
      id: "bill",
      reference: "IC-CA-EXISTING",
      status: "Issued",
      total: 50000,
      currency: "CAD",
      customer: { email: "a@example.test" },
      items: [{ productId: "inner-code" }],
    };
    await ledger.put("billing_documents", invoice);
    const result = await ledger.resolve(s, "a", "receipt", "full", legacy);
    assert.equal(result.syncReviewRequired, true);
    assert.deepEqual((await ledger.list("billing_documents"))[0], invoice);
    assert.equal((await ledger.list("billing_sync_reviews")).length, 1);
    assert.equal((await ledger.list("billing_payments")).length, 0);
    await db.query("DELETE FROM documents WHERE section='billing_documents'");
    const linked = await ledger.bindInvoice(s, invoice);
    assert.equal(linked.clientId, "a");
    s.programmes.a = {
      packageId: "inner-code",
      paymentOption: "full",
      status: "Not Activated",
    };
    assert(
      ledger.applyPayment(s, {
        ...linked,
        receipt: {
          amount: 50000,
          received: 50000,
          date: "2026-11-03",
          method: "Interac",
          reference: "bank-new",
        },
      }),
    );
    assert.equal(s.programmes.a.full, true);
    assert.equal(s.programmes.a.balance, true);
    assert.equal(s.programmes.a.deposit, true);
    assert.equal(s.programmes.a.status, "Not Activated");
    await assert.rejects(
      () => ledger.bindInvoice(s, { ...invoice, id: "duplicate" }),
      /already exists/,
    );
  }));

test("communications retain sent status, superseding reasons, follow-ups, and deleted-document email history", () =>
  fixture(async (db, crypt, s) => {
    const ledger = programmeLedger(db, crypt),
      comms = communicationStore(db, crypt);
    s.outbox.sent = {
      id: "sent",
      client: "a",
      subject: "Old invoice",
      status: "Sent",
      documentId: "old",
      created: "2026-11-03",
    };
    const note = await comms.annotate(
      s,
      {
        client: "a",
        emailId: "sent",
        channel: "Email",
        note: "Replaced by full payment invoice",
        disposition: "Superseded",
        replacement: "NEW-INVOICE",
        nextAction: "Confirm plan review",
        due: "2026-11-05",
      },
      "coach",
    );
    assert.equal(s.outbox.sent.status, "Sent");
    assert.equal((await comms.annotation("sent")).disposition, "Superseded");
    assert.equal((await comms.tasks()).length, 1);
    await comms.complete(s, note.id, "coach");
    assert.equal((await comms.tasks()).length, 0);
    await assert.rejects(
      () =>
        comms.annotate(
          s,
          {
            client: "a",
            emailId: "sent",
            note: "Wrong status",
            disposition: "Discarded",
          },
          "coach",
        ),
      /unsent draft/,
    );
    await assert.rejects(
      () =>
        comms.annotate(
          s,
          { client: "a", emailId: "other-client", note: "Not mine" },
          "coach",
        ),
      /for this client/,
    );
    await ledger.put("outbox", s.outbox.sent);
    await ledger.put("billing_documents", {
      id: "old",
      version: 1,
      status: "Issued",
      reference: "OLD",
      customer: { email: "a@example.test" },
      total: 15000,
    });
    await db.transaction(() =>
      deleteBillingDocument(db, crypt, {
        id: "old",
        version: 1,
        confirm: true,
      }),
    );
    delete s.outbox.sent;
    const data = await comms.get(s, "a");
    assert.equal(data.emails[0].status, "Sent");
    assert.equal(data.emails[0].annotation.disposition, "Superseded");
    assert(data.events.some((e) => e.label.includes("Document Deleted")));
    assert.equal((await ledger.list("billing_documents")).length, 0);
    assert.equal((await ledger.list("communication_email_archive")).length, 1);
  }));
