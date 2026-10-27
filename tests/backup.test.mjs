import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { database } from "../lib/database.mjs";
import { encryption } from "../lib/security.mjs";
import { restoreBackup } from "../lib/backup.mjs";
import { reportData, reportPDF } from "../lib/reports.mjs";
test("authenticated encrypted backup restore rejects wrong key and overwrite", async () => {
  const dir = await mkdtemp(join(tmpdir(), "seek-restore-"));
  process.env.NODE_ENV = "test";
  process.env.TEST_DB_PATH = join(dir, "restore.db");
  delete process.env.DATABASE_URL;
  const db = await database(),
    crypt = encryption(randomBytes(32).toString("base64"));
  try {
    const backup = {
      format: "seek-encrypted-v1",
      accounts: [
        {
          id: "client",
          email_hash: "hash",
          payload: crypt.seal({
            role: "client",
            email: "private@example.test",
          }),
        },
      ],
      documents: [
        {
          section: "journals",
          record_key: "client",
          payload: crypt.seal({ daily: { body: "private entry" } }),
        },
      ],
    };
    await assert.rejects(
      restoreBackup(db, encryption(randomBytes(32).toString("base64")), backup),
    );
    await restoreBackup(db, crypt, backup);
    const rows = await db.query("SELECT payload FROM documents");
    assert.equal(crypt.open(rows[0].payload).daily.body, "private entry");
    await assert.rejects(restoreBackup(db, crypt, backup), /empty database/);
  } finally {
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("report shows coverage, distinguishes rest/adaptation and generates PDF", async () => {
  const s = {
    programmes: { a: { start: "2026-01-01" } },
    customPlans: { a: [["Health", "Movement"]] },
    records: {
      "a:2026-01-01": { 0: "done" },
      "a:2026-01-02": { 0: "adapted" },
      "a:2026-01-03": { 0: "rest" },
    },
  };
  const d = reportData(s, "a", 7);
  assert.equal(d.recordedDays, 3);
  assert.equal(d.pillars[0].possible, 7);
  assert.equal(d.pillars[0].done, 1);
  assert.equal(d.pillars[0].adapted, 1);
  assert.equal(d.pillars[0].rest, 1);
  assert.equal(
    (await reportPDF("Client", d)).subarray(0, 4).toString(),
    "%PDF",
  );
});
