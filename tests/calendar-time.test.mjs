import test from "node:test";
import assert from "node:assert/strict";
import "../public/calendar.js";
const t = globalThis.coachingTime;
test("Calgary and India show exact dates across midnight and daylight saving", () => {
  assert.deepEqual(t.fromLocal("2026-07-10", "14:00"), {
    date: "2026-07-10",
    time: "20:00",
  });
  assert.deepEqual(t.fromLocal("2026-12-10", "14:00"), {
    date: "2026-12-10",
    time: "21:00",
  });
  assert.equal(
    t.local(t.utc(t.fromLocal("2026-07-10", "14:00")), t.india).date,
    "2026-07-11",
  );
  assert.match(
    t.display(t.fromLocal("2026-12-10", "14:00")),
    /Calgary Time: 10 Dec 2026, 02:00 pm \| India Time: 11 Dec 2026, 02:30 am/,
  );
  assert.equal(t.dateAt("2026-11-03T01:00:00Z"), "2026-11-02");
});
test("recurring Calgary calls keep the same wall time through spring and autumn clock changes", () => {
  for (const start of ["2026-03-01", "2026-10-25"]) {
    const calls = t.calls("a", start, "14:00", t.calgary);
    assert.equal(calls.length, 10);
    for (const c of calls) assert.equal(t.local(t.utc(c)).time, "14:00");
    assert(new Set(calls.map((c) => c.time)).size === 2);
  }
});
test("invalid, skipped and repeated wall times are rejected rather than guessed", () => {
  for (const [date, time] of [
    ["2026-02-30", "12:00"],
    ["2026-03-08", "02:30"],
    ["2026-11-01", "01:30"],
    ["2026-12-01", "24:00"],
  ])
    assert.throws(() => t.fromLocal(date, time));
});
test("legacy UTC events keep their instant, while new event shifts retain Calgary wall time", () => {
  const old = { date: "2026-10-30", time: "20:00" };
  assert.equal(t.local(t.utc(old)).time, "14:00");
  assert.deepEqual(t.shiftEvent(old, 5), { date: "2026-11-04", time: "20:00" });
  const c = t.calls("a", "2026-10-26", "14:00", t.calgary)[0],
    shifted = t.shiftEvent(c, 7);
  assert.equal(t.local(t.utc(shifted)).time, "14:00");
  assert.equal(shifted.time, "21:00");
  assert(
    t.overlaps(
      { date: "2026-11-01", time: "23:50" },
      { date: "2026-11-02", time: "00:05" },
      20,
      20,
    ),
  );
});

test("Calgary day and five-business-day refund rule agree with the confirmed policy", async () => {
  const { innerCodeTerms } = await import("../lib/inner-code-terms.mjs");
  assert.match(
    innerCodeTerms,
    /Eligible CAD 150 deposits will be returned within five business days/,
  );
  assert.equal(globalThis.addBusinessDays("2026-10-30", 5), "2026-11-06");
  assert.equal(t.dateAt("2026-11-03T01:00:00Z"), "2026-11-02");
});
