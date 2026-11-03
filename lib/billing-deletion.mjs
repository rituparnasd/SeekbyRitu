const invalid = (message, status = 409) => {
  throw Object.assign(Error(message), { status });
};
const read = async (db, crypt, section, id) => {
  const rows = await db.query(
    "SELECT payload FROM documents WHERE section=? AND record_key=?",
    [section, id],
  );
  return rows[0] ? crypt.open(rows[0].payload) : null;
};
async function bump(db) {
  const rows = await db.query(
    "SELECT value FROM metadata WHERE name='revision'",
  );
  const next = Number(rows[0]?.value || 0) + 1;
  await db.query(
    "INSERT INTO metadata(name,value) VALUES('revision',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value",
    [String(next)],
  );
}
// The caller holds the same transaction/advisory lock as other billing mutations.
export async function deleteBillingDocument(db, crypt, b) {
  const d = await read(db, crypt, "billing_documents", b.id);
  if (!d) invalid("Invoice not found.", 404);
  if (d.version !== b.version)
    invalid("This invoice changed. Reload before deleting it.");
  if (!["Draft", "Issued", "Cancelled"].includes(d.status))
    invalid("This type of record cannot be deleted here.");
  const payments = await db.query(
    "SELECT payload FROM documents WHERE section='billing_payments'",
  );
  if (payments.some((row) => crypt.open(row.payload).invoiceId === d.id))
    invalid(
      "A payment or receipt is linked to this invoice. It cannot be deleted as an unpaid mistake.",
    );
  if (d.status !== "Draft" && b.confirm !== true)
    invalid("Confirm deletion of this issued invoice.", 400);
  const outbox = await db.query(
    "SELECT record_key,payload FROM documents WHERE section='outbox'",
  );
  const related = outbox.filter(
    (row) => crypt.open(row.payload).documentId === d.id,
  );
  for (const row of related) {
    const delivery = await db.query(
      "SELECT payload FROM deliveries WHERE id=?",
      [row.record_key],
    );
    if (
      delivery[0] &&
      ["Pending", "Unknown"].includes(crypt.open(delivery[0].payload).status)
    )
      invalid(
        "Email delivery is pending or uncertain. Check and resolve it in Email Center before deleting the invoice.",
      );
  }
  if (d.status === "Draft") {
    const deleted = {
      ...d,
      version: d.version + 1,
      deletedAt: new Date().toISOString(),
    };
    await db.query(
      "INSERT INTO documents(section,record_key,payload) VALUES('billing_trash',?,?) ON CONFLICT(section,record_key) DO UPDATE SET payload=excluded.payload",
      [d.id, crypt.seal(deleted)],
    );
  }
  const deletion = {
    id: "deleted:" + d.id,
    documentId: d.id,
    clientId: d.clientId || "",
    customerEmail: d.customer?.email || "",
    reference: d.reference || "Draft",
    total: d.total,
    paymentStage: d.paymentStage,
    event: "Document Deleted",
    reason: "Deleted by the coach as an incorrect unpaid document.",
    createdAt: new Date().toISOString(),
  };
  await db.query(
    "INSERT INTO documents(section,record_key,payload) VALUES('billing_document_events',?,?) ON CONFLICT(section,record_key) DO NOTHING",
    [deletion.id, crypt.seal(deletion)],
  );
  for (const row of related) {
    const email = crypt.open(row.payload);
    await db.query(
      "INSERT INTO documents(section,record_key,payload) VALUES('communication_email_archive',?,?) ON CONFLICT(section,record_key) DO NOTHING",
      [
        email.id || row.record_key,
        crypt.seal({
          ...email,
          archivedAt: new Date().toISOString(),
          documentDeleted: true,
        }),
      ],
    );
    await db.query(
      "DELETE FROM documents WHERE section='outbox' AND record_key=?",
      [row.record_key],
    );
    await db.query("DELETE FROM deliveries WHERE id=?", [row.record_key]);
  }
  await db.query(
    "DELETE FROM documents WHERE section='billing_documents' AND record_key=?",
    [d.id],
  );
  await bump(db);
  return {
    deleted: true,
    restorable: d.status === "Draft",
    reference: d.reference || null,
  };
}
export async function restoreBillingDraft(db, crypt, b) {
  const d = await read(db, crypt, "billing_trash", b.id);
  if (!d) invalid("Deleted draft not found.", 404);
  if (d.version !== b.version || d.status !== "Draft")
    invalid("This deleted draft changed. Reload first.");
  if (await read(db, crypt, "billing_documents", d.id))
    invalid("A record with this ID already exists.");
  delete d.deletedAt;
  d.version++;
  d.updatedAt = new Date().toISOString();
  await db.query(
    "INSERT INTO documents(section,record_key,payload) VALUES('billing_documents',?,?)",
    [d.id, crypt.seal(d)],
  );
  await db.query(
    "DELETE FROM documents WHERE section='billing_trash' AND record_key=?",
    [d.id],
  );
  return { restored: true };
}
export const invoiceCleanupStatusKey = "owner_mistaken_invoice_cleanup_status";
const marker = "owner_requested_invoice_removal_IC_IS_SQEWVA_JWUWQY";
export async function removeRequestedMistakenInvoice(db, crypt) {
  return db.transaction(async () => {
    const report = async (result) => {
      await db.query(
        "INSERT INTO metadata(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value",
        [invoiceCleanupStatusKey, JSON.stringify(result)],
      );
      return result;
    };
    const done = await db.query("SELECT value FROM metadata WHERE name=?", [
      marker,
    ]);
    if (done[0]) return report(JSON.parse(done[0].value));
    const rows = await db.query(
      "SELECT payload FROM documents WHERE section='billing_documents'",
    );
    const invoice = rows
      .map((row) => crypt.open(row.payload))
      .find((d) => d.reference === "IC-IS-SQEWVA-JWUWQY");
    if (invoice) {
      if (invoice.currency !== "CAD" || invoice.total !== 5000)
        return report({
          removed: false,
          reason:
            "Invoice details differ from the specified mistaken CAD 50 invoice.",
        });
      try {
        await deleteBillingDocument(db, crypt, {
          id: invoice.id,
          version: invoice.version,
          confirm: true,
        });
      } catch (error) {
        if (error.status)
          return report({ removed: false, reason: error.message });
        throw error;
      }
    }
    const result = {
      removed: !!invoice,
      completedAt: new Date().toISOString(),
    };
    await db.query("INSERT INTO metadata(name,value) VALUES(?,?)", [
      marker,
      JSON.stringify(result),
    ]);
    return report(result);
  });
}
