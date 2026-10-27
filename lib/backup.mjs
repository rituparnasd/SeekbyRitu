export async function restoreBackup(db, crypt, backup) {
  if (backup.format !== "seek-encrypted-v1")
    throw Error("Unsupported backup format");
  const tables = {
    accounts: ["id", "email_hash", "payload"],
    documents: ["section", "record_key", "payload"],
    signatures: ["id", "payload"],
    deliveries: ["id", "payload"],
    journal_entries: ["id", "client_id", "entry_date", "kind", "payload"],
    reports: ["id", "client_id", "payload"],
    financial_documents: ["id", "payload"],
    audit: ["id", "actor", "action", "created"],
    metadata: ["name", "value"],
  };
  for (const [table, columns] of Object.entries(tables)) {
    const rows = backup[table] || [];
    if (!Array.isArray(rows)) throw Error("Invalid backup");
    if (columns.includes("payload"))
      for (const row of rows) crypt.open(row.payload);
  }
  return db.transaction(async () => {
    for (const table of Object.keys(tables))
      if ((await db.query(`SELECT * FROM ${table}`)).length)
        throw Error(
          "Restore requires a new empty database; existing data is never overwritten",
        );
    for (const [table, columns] of Object.entries(tables))
      for (const row of backup[table] || [])
        await db.query(
          `INSERT INTO ${table}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`,
          columns.map((k) => row[k]),
        );
    return true;
  });
}
