import test from "node:test";
import assert from "node:assert/strict";
import { addTestClient } from "../lib/test-client.mjs";
import { reconcileWorkflow } from "../lib/workflow.mjs";
test("one additive test profile has 3 habits per pillar and never generates real enrollment emails", () => {
  const s = {
    leads: [{ id: "real", first: "Existing", email: "existing@example.test" }],
    programmes: {},
    workflow: {},
    customPlans: {},
    practicePlans: {},
    intakes: {},
    records: {},
    checkins: {},
    journals: {},
    dailyMaterials: {},
    materialProgress: {},
    outbox: {},
  };
  const l = addTestClient(s, "2026-10-29");
  assert.equal(l.isTest, true);
  assert(l.email.endsWith("@example.invalid"));
  assert.equal(addTestClient(s).id, l.id);
  assert.equal(s.leads.length, 2);
  for (const pillar of [
    "Health",
    "Relationships",
    "Career",
    "Money",
    "Spirituality",
  ])
    assert.equal(s.customPlans[l.id].filter((h) => h[0] === pillar).length, 3);
  reconcileWorkflow(s, "2026-10-29");
  assert.equal(
    Object.values(s.outbox).filter((e) => e.client === l.id).length,
    0,
  );
  assert.equal(s.leads[0].id, "real");
});
