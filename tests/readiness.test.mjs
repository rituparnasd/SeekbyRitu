import test from "node:test";
import assert from "node:assert/strict";
import { readiness } from "../lib/readiness.mjs";
test("Render readiness fails closed for missing or unavailable storage, without leaking errors", async () => {
  assert.deepEqual(await readiness(undefined), {
    status: 503,
    body: { status: "setup_required", ready: false },
  });
  const unavailable = await readiness({
    query: async () => {
      throw Error("postgres://private:secret@host/db");
    },
  });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.body.ready, false);
  assert(!JSON.stringify(unavailable).includes("secret"));
  assert.equal((await readiness({ query: async () => [] })).status, 503);
});
test("Render readiness is healthy only after a successful database round trip", async () => {
  const result = await readiness({
    query: async (sql) => {
      assert.equal(sql, "SELECT 1 AS ready");
      return [{ ready: 1 }];
    },
  });
  assert.deepEqual(result, {
    status: 200,
    body: { status: "ok", ready: true },
  });
});
