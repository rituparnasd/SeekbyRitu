// One-off cleanup explicitly requested by the owner. Never deletes future drafts.
export const draftCleanupMarker = "owner_billing_draft_cleanup_2026_11_03";
export const draftCleanupCutoff = "2026-11-03T17:38:11.000Z";
export async function removeRequestedDrafts(db, crypt) {
  return db.transaction(async () => {
    const done = await db.query("SELECT value FROM metadata WHERE name=?", [
      draftCleanupMarker,
    ]);
    if (done[0]) return JSON.parse(done[0].value);
    const receipts = await db.query(
      "SELECT payload FROM documents WHERE section='billing_payments'",
    );
    const paid = new Set(
      receipts.map((row) => crypt.open(row.payload).invoiceId),
    );
    const rows = await db.query(
      "SELECT record_key,payload FROM documents WHERE section='billing_documents'",
    );
    let removed = 0;
    for (const row of rows) {
      const draft = crypt.open(row.payload);
      if (
        draft.status !== "Draft" ||
        draft.reference ||
        draft.issuedAt ||
        paid.has(draft.id)
      )
        continue;
      if (
        draft.updatedAt &&
        (!Number.isFinite(Date.parse(draft.updatedAt)) ||
          Date.parse(draft.updatedAt) > Date.parse(draftCleanupCutoff))
      )
        continue;
      await db.query(
        "DELETE FROM documents WHERE section='billing_documents' AND record_key=?",
        [row.record_key],
      );
      removed++;
    }
    const result = {
      removed,
      cutoff: draftCleanupCutoff,
      completedAt: new Date().toISOString(),
    };
    await db.query("INSERT INTO metadata(name,value) VALUES(?,?)", [
      draftCleanupMarker,
      JSON.stringify(result),
    ]);
    return result;
  });
}
