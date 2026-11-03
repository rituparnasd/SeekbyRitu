import test from "node:test";
import assert from "node:assert/strict";
import "../public/packages.js";
import { reconcileWorkflow } from "../lib/workflow.mjs";
import { packageTerms } from "../lib/package-terms.mjs";
const p = globalThis.innerCodePackages;
test("package prices, calls and the final 95% Premium rule are exact", () => {
  assert.deepEqual(
    p.all.map((c) => [c.price, c.deposit, c.balance, c.calls, c.interval]),
    [
      [50, 0, 50, 0, 0],
      [100, 0, 100, 6, 5],
      [500, 150, 350, 10, 3],
    ],
  );
  assert.equal(p.get("inner-code").refundThreshold, 95);
  assert.equal(p.get("inner-code").refundBusinessDays, 5);
  assert.equal(
    p.paid({ packageId: "inner-code-self-guided", balance: true }),
    true,
  );
  assert.equal(p.paid({ packageId: "inner-code-guided", balance: true }), true);
  assert.equal(p.paid({ packageId: "inner-code", balance: true }), false);
  assert.equal(
    p.paid({ packageId: "inner-code", deposit: true, balance: true }),
    true,
  );
  assert.match(packageTerms("inner-code"), /95%/);
  assert(!packageTerms("inner-code").includes("90%"));
  assert.match(
    packageTerms("inner-code-self-guided"),
    /No private coaching calls/,
  );
  assert.match(packageTerms("inner-code-guided"), /Six private 20-minute/);
});
test("India packages activate after full payment and plan preparation, with zero or six calls and no Premium payment demands", () => {
  for (const cfg of p.all.filter((c) => !c.deposit)) {
    const s = {
      leads: [{ id: "a", first: "Client" }],
      programmes: {
        a: {
          packageId: cfg.id,
          status: "Not Activated",
          balance: true,
          timeZone: globalThis.coachingTime.calgary,
          localTime: "14:00",
          verifiedAt: { balance: "2026-10-01T18:00:00Z" },
        },
      },
      intakes: { a: { submitted: "2026-10-02T18:00:00Z" } },
      workflow: { a: { planReady: "2026-10-06T18:00:00Z" } },
      outbox: {},
    };
    reconcileWorkflow(s, "2026-10-06");
    assert.equal(s.programmes.a.status, "Active");
    assert.equal(s.programmes.a.start, "2026-10-07");
    assert.equal(s.programmes.a.calls.length, cfg.calls);
    assert.deepEqual(
      s.programmes.a.calls.map((c) => c.programmeDay),
      cfg.calls ? [5, 10, 15, 20, 25, 30] : [],
    );
    assert(
      !Object.values(s.outbox).some((e) => /CAD (150|350|500)/.test(e.body)),
    );
    assert(!s.outbox["a:balance"]);
    assert(!s.outbox["a:slots"]);
    assert(s.outbox["a:activation"]);
  }
});
test("a paid Self-Guided client does not start tracking before their personalised plan is ready", () => {
  const s = {
    leads: [{ id: "a" }],
    programmes: {
      a: {
        packageId: "inner-code-self-guided",
        status: "Not Activated",
        balance: true,
      },
    },
    workflow: {},
    intakes: {},
    outbox: {},
  };
  reconcileWorkflow(s, "2026-10-06");
  assert.equal(s.programmes.a.status, "Not Activated");
  assert(!s.outbox["a:activation"]);
  assert(s.outbox["a:paid"]);
});
