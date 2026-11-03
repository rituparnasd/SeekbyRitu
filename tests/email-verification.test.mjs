import test from "node:test";
import assert from "node:assert/strict";
import { emailVerification } from "../lib/email-verification.mjs";
test("inbox verification separates provider acceptance from actual receipt, limits retries and rejects stale confirmation", async () => {
  let saved = null,
    clock = new Date("2026-11-03T12:00:00Z"),
    sent = 0;
  const service = emailVerification({
    read: async () => structuredClone(saved),
    write: async (value) => {
      saved = structuredClone(value);
    },
    now: () => clock,
    send: async () => {
      sent++;
      return { status: "Sent" };
    },
  });
  await assert.rejects(service.confirm("missing"), /matching message/);
  const first = await service.send();
  assert.equal(first.status, "Sent");
  assert(first.acceptedAt);
  assert.equal(first.confirmedAt, undefined);
  await assert.rejects(service.send(), /one minute/);
  assert.equal(sent, 1);
  await assert.rejects(service.confirm("wrong-reference"), /matching message/);
  const confirmed = await service.confirm(first.id);
  assert(confirmed.confirmedAt);
  clock = new Date("2026-11-03T12:01:01Z");
  const next = await service.send();
  assert.notEqual(next.id, first.id);
  assert.equal(next.confirmedAt, undefined);
  await assert.rejects(service.confirm(first.id), /matching message/);
});
test("failed or interrupted tests never imply confirmed inbox delivery", async () => {
  for (const outcome of ["Failed", "Unknown", "throw"]) {
    let saved;
    const service = emailVerification({
      read: async () => saved,
      write: async (v) => {
        saved = structuredClone(v);
      },
      send: async () => {
        if (outcome === "throw") throw Error("sensitive provider error");
        return { status: outcome };
      },
    });
    const result = await service.send();
    assert.equal(result.status, outcome === "Failed" ? "Failed" : "Unknown");
    assert.equal(result.acceptedAt, undefined);
    assert.equal(result.confirmedAt, undefined);
    assert(!JSON.stringify(saved).includes("sensitive"));
    if (outcome === "Failed") await assert.rejects(service.confirm(result.id));
    else assert((await service.confirm(result.id)).confirmedAt);
  }
});
