import test from "node:test";
import assert from "node:assert/strict";
import { reconcileWorkflow } from "../lib/workflow.mjs";
test("server event workflow creates deadlines and idempotent messages without an open coach browser", () => {
  const s = {
    leads: [{ id: "a", first: "Client" }],
    programmes: { a: { status: "Not Activated", deposit: true } },
    intakes: { a: { submitted: "2026-01-01T10:00:00Z" } },
    workflow: {},
    outbox: {},
  };
  reconcileWorkflow(s, "2026-01-01");
  assert.equal(s.workflow.a.planDue, "2026-01-04");
  assert(s.outbox["a:answers"]);
  const n = Object.keys(s.outbox).length;
  reconcileWorkflow(s, "2026-01-01");
  assert.equal(Object.keys(s.outbox).length, n);
  s.workflow.a.walkthroughDone = "2026-01-03";
  s.programmes.a.agreed = true;
  s.programmes.a.balance = true;
  reconcileWorkflow(s, "2026-01-03");
  assert.equal(s.programmes.a.start, "2026-01-04");
  assert.equal(s.programmes.a.calls.length, 10);
  assert.equal(s.outbox["a:welcome"].due, "2026-01-04");
});
