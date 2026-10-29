import test from "node:test";
import assert from "node:assert/strict";
import { setupDiagnosis } from "../lib/setup-diagnostics.mjs";
test("setup diagnostics identify causes without returning credential-bearing error text", () => {
  const secret = "postgres://private:private-password@example.test/db";
  for (const [stage, error, code] of [
    ["encryption", Error(secret), "KEY_FORMAT"],
    ["database", { code: "28P01", message: secret }, "DATABASE_AUTH"],
    ["database", { code: "ENOTFOUND", message: secret }, "DATABASE_DNS"],
    [
      "database",
      { code: "DEPTH_ZERO_SELF_SIGNED_CERT", message: secret },
      "DATABASE_TLS",
    ],
    [
      "database",
      { code: "ERR_INVALID_URL", message: secret },
      "DATABASE_URL_FORMAT",
    ],
    [
      "database",
      { message: "The server does not support SSL connections " + secret },
      "DATABASE_TLS_UNSUPPORTED",
    ],
  ]) {
    const value = setupDiagnosis(stage, error);
    assert.equal(value.code, code);
    assert.equal(JSON.stringify(value).includes("private-password"), false);
  }
});
