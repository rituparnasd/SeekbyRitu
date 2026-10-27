import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
const context = new AsyncLocalStorage();
export async function database() {
  let sql;
  if (process.env.DATABASE_URL) {
    const u = new URL(process.env.DATABASE_URL);
    for (const k of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
      u.searchParams.delete(k);
    const pool = new pg.Pool({
      connectionString: u.toString(),
      ssl: { rejectUnauthorized: true },
      max: 5,
    });
    sql = {
      async query(q, args = []) {
        let i = 0;
        return (
          await (context.getStore() || pool).query(
            q.replace(/\?/g, () => "$" + ++i),
            args,
          )
        ).rows;
      },
      async transaction(fn) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query("SELECT pg_advisory_xact_lock(7341286)");
          const value = await context.run(client, fn);
          await client.query("COMMIT");
          return value;
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        } finally {
          client.release();
        }
      },
      async close() {
        await pool.end();
      },
    };
  } else if (process.env.NODE_ENV === "test" && process.env.TEST_DB_PATH) {
    const db = new DatabaseSync(process.env.TEST_DB_PATH);
    sql = {
      async query(q, args = []) {
        const s = db.prepare(q);
        return /^\s*(SELECT|INSERT.*RETURNING)/i.test(q)
          ? s.all(...args)
          : (s.run(...args), []);
      },
      async transaction(fn) {
        db.exec("BEGIN IMMEDIATE");
        try {
          const value = await fn();
          db.exec("COMMIT");
          return value;
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
      async close() {
        db.close();
      },
    };
  } else
    throw Error(
      "DATABASE_URL is required; local storage is not used in production",
    );
  for (const q of [
    "CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, email_hash TEXT UNIQUE NOT NULL, payload TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, csrf TEXT NOT NULL, expires TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS invitations (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS documents (section TEXT NOT NULL, record_key TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(section,record_key))",
    "CREATE TABLE IF NOT EXISTS metadata (name TEXT PRIMARY KEY, value TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, created TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS deliveries (id TEXT PRIMARY KEY, payload TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS journal_entries (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, entry_date TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL)",
    "CREATE INDEX IF NOT EXISTS journal_client_date_idx ON journal_entries(client_id,entry_date)",
    "CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, payload TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS financial_documents (id TEXT PRIMARY KEY, payload TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS signatures (id TEXT PRIMARY KEY, payload TEXT NOT NULL)",
    "CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)",
    "CREATE INDEX IF NOT EXISTS invitations_user_idx ON invitations(user_id)",
  ])
    await sql.query(q);
  return sql;
}
