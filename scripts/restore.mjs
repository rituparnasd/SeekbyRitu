import { readFile } from "node:fs/promises";
import { database } from "../lib/database.mjs";
import { encryption } from "../lib/security.mjs";
import { restoreBackup } from "../lib/backup.mjs";
if (process.argv.length !== 3)
  throw Error("Usage: node scripts/restore.mjs /path/to/encrypted-backup.json");
const db = await database();
try {
  await restoreBackup(
    db,
    encryption(process.env.DATA_ENCRYPTION_KEY),
    JSON.parse(await readFile(process.argv[2], "utf8")),
  );
  console.log(
    "Encrypted backup restored into empty database. Sessions and invitation links are not restored.",
  );
} finally {
  await db.close();
}
