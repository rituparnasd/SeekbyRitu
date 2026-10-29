import test from "node:test";
import assert from "node:assert/strict";
import { LoginLimiter } from "../lib/login-limiter.mjs";
test("successful sign-ins never accumulate failures and clear an earlier failure", () => {
  const limiter = new LoginLimiter();
  for (let i = 0; i < 30; i++) {
    assert.equal(limiter.retryAfter("coach"), 0);
    limiter.success("coach");
  }
  for (let i = 0; i < 11; i++) limiter.failure("coach");
  limiter.success("coach");
  assert.equal(limiter.failure("coach"), 0);
});
test("failed credentials remain limited and exact remaining cooldown expires", () => {
  let now = 0;
  const limiter = new LoginLimiter({ now: () => now });
  for (let i = 0; i < 11; i++) assert.equal(limiter.failure("coach"), 0);
  assert.equal(limiter.failure("coach"), 900);
  now = 65000;
  assert.equal(limiter.retryAfter("coach"), 835);
  assert.equal(limiter.retryAfter("other"), 0);
  now = 900000;
  assert.equal(limiter.retryAfter("coach"), 0);
  assert.equal(limiter.failure("coach"), 0);
});
