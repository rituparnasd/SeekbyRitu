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
  assert.equal(s.workflow.a.planDue, "2026-01-06");
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

test("three business days skips weekends and does not change programme-day arithmetic", () => {
  assert.equal(globalThis.addBusinessDays("2026-10-30", 3), "2026-11-04");
  assert.equal(globalThis.addBusinessDays("2026-10-31", 3), "2026-11-04");
  assert.equal(globalThis.addBusinessDays("2026-11-02", 3), "2026-11-05");
  assert.throws(() => globalThis.addBusinessDays("2026-02-30", 3));
});

test("ten calls are generated on every third day; conflicts block activation until resolved", () => {
  const make = (id) => ({ id, first: id });
  const s = {
    leads: [make("a"), make("b")],
    programmes: Object.fromEntries(
      ["a", "b"].map((id) => [
        id,
        {
          status: "Not Activated",
          deposit: true,
          balance: true,
          agreed: true,
          time: "18:00",
        },
      ]),
    ),
    workflow: {
      a: { walkthroughDone: "2026-10-01" },
      b: { walkthroughDone: "2026-10-01" },
    },
    intakes: { a: { submitted: "2026-10-01" }, b: { submitted: "2026-10-01" } },
    outbox: {},
  };
  reconcileWorkflow(s, "2026-10-01");
  assert.equal(s.programmes.a.calls.length, 10);
  assert.deepEqual(
    s.programmes.a.calls.map((c) => c.programmeDay),
    [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
  );
  assert.equal(s.programmes.a.calls[0].date, "2026-10-04");
  assert.equal(s.programmes.b.status, "Not Activated");
  assert.match(s.workflow.b.activationIssue, /conflict/);
  s.programmes.b.time = "18:20";
  reconcileWorkflow(s, "2026-10-01");
  assert.equal(s.programmes.b.status, "Active");
  assert.equal(s.workflow.b.activationIssue, undefined);
  s.programmes.a.status = "On Hold";
  reconcileWorkflow(s, "2026-10-01");
  assert.equal(s.outbox["a:welcome"].status, "Paused");
  s.programmes.a.status = "Ended";
  reconcileWorkflow(s, "2026-10-01");
  assert.equal(s.outbox["a:welcome"].status, "Cancelled");
});

test("activation also respects walkthroughs and coach preparation blocks", () => {
  const make = (busy) => ({
    leads: [{ id: "a", first: "A" }],
    programmes: {
      a: {
        status: "Not Activated",
        deposit: true,
        balance: true,
        agreed: true,
        time: "18:20",
      },
    },
    intakes: { a: { submitted: "2026-10-01" } },
    workflow: { a: { walkthroughDone: "2026-10-01" }, other: busy },
    outbox: {},
  });
  for (const busy of [
    { booking: { date: "2026-10-04", time: "18:00" } },
    { workBlock: { date: "2026-10-04", time: "18:00", duration: 60 } },
  ]) {
    const s = make(busy);
    reconcileWorkflow(s, "2026-10-01");
    assert.equal(s.programmes.a.status, "Not Activated");
    assert.match(s.workflow.a.activationIssue, /conflict/);
  }
});
