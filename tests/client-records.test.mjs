import test from "node:test";
import assert from "node:assert/strict";
import { habitStatuses } from "../lib/client-records.mjs";
import { reportData } from "../lib/reports.mjs";
test("only assigned habit slots and recognised statuses count as records", () => {
  assert.deepEqual(habitStatuses({ 0: "done", 1: "rest" }, 2), {
    0: "done",
    1: "rest",
  });
  for (const value of [
    { 99: "done" },
    { "-1": "done" },
    { "01": "done" },
    { 0: "invented" },
    ["done"],
    null,
  ])
    assert.throws(() => habitStatuses(value, 2));
});
test("reports place edited habits under their current agreed pillar", () => {
  const s = {
    programmes: { a: { start: "2026-10-01" } },
    customPlans: { a: [["Health", "Original"]] },
    localizedEdits: { a: { en: { 0: ["Career", "Edited"] } } },
    records: { "a:2026-10-01": { 0: "done" } },
  };
  const r = reportData(s, "a", 7);
  assert.equal(r.pillars.find((p) => p.name === "Career").done, 1);
  assert.equal(r.pillars.find((p) => p.name === "Health").possible, 0);
});
