import test from "node:test";
import assert from "node:assert/strict";
import "../public/programme-content.js";
import "../public/payment-links.js";
import "../public/document-format.js";
import { documentReference } from "../lib/document-references.mjs";
import { reconcileWorkflow } from "../lib/workflow.mjs";
const content = globalThis.programmeContent;
test("all products share complete approved content with their own prices, calls, payment methods and next steps", () => {
  for (const [id, price, calls, prefix] of [
    ["inner-code", 500, 10, "IC-CA"],
    ["inner-code-guided", 100, 6, "IC-IG"],
    ["inner-code-self-guided", 50, 0, "IC-IS"],
  ]) {
    const p = content.get(id);
    assert.equal(p.price, price);
    assert.equal(p.calls, calls);
    assert.equal(p.prefix, prefix);
    assert.equal(
      globalThis.documentFormat.plain(content.delta(id)).trim(),
      content.terms(id).trim(),
    );
    assert.equal(
      globalThis.documentFormat.plain(content.descriptionDelta(id)),
      content.description(id),
    );
    assert.match(content.terms(id), /3–5 business days/);
    assert.match(content.terms(id), /four or more days/);
    if (id === "inner-code") {
      assert.match(content.payment(id, 150), /Interac e-Transfer/);
      assert.match(content.nextText(id), /15-minute/);
      assert.match(content.terms(id), /95%/);
    } else {
      assert.match(content.payment(id, price), /https:\/\/buy.stripe.com/);
      assert(!content.nextText(id).includes("CAD 350"));
      assert(!content.terms(id).includes("95%"));
    }
  }
  assert(
    !content
      .steps("inner-code-self-guided")
      .some(([title]) => /REVIEW|COACHING/.test(title)),
  );
});
test("invoice references are unique non-sequential letters with package-specific prefixes", () => {
  const refs = new Set();
  for (let n = 0; n < 1000; n++) {
    const value = documentReference("inner-code-guided", refs);
    assert.match(value, /^IC-IG-[A-Z]{6}-[A-Z]{6}$/);
    assert(!/\d/.test(value));
    assert(!refs.has(value));
    refs.add(value);
  }
  assert.match(documentReference("custom-service"), /^SBR-[A-Z]{6}-[A-Z]{6}$/);
});
test("balance verified on Friday schedules the programme by the next business day and retains 20-minute coaching calls", () => {
  const s = {
    leads: [{ id: "a", first: "Client" }],
    programmes: {
      a: {
        packageId: "inner-code",
        status: "Not Activated",
        deposit: true,
        balance: true,
        agreed: true,
        verifiedAt: { balance: "2026-11-06T18:00:00Z" },
        time: "10:00",
      },
    },
    intakes: { a: { submitted: "2026-11-02" } },
    workflow: { a: { walkthroughDone: "2026-11-06" } },
    outbox: {},
  };
  reconcileWorkflow(s, "2026-11-06");
  assert.equal(s.programmes.a.start, "2026-11-09");
  assert.equal(s.programmes.a.calls.length, 10);
  assert.match(s.outbox["a:first"].body, /What Happens Next/);
  assert.match(s.outbox["a:first"].body, /3–5 business days/);
  assert.match(s.outbox["a:balance"].body, /one business day/);
  assert(!s.outbox["a:balance"].body.includes("buy.stripe.com"));
});

test("product-specific next steps update unsent first-step drafts without rewriting sent mail", () => {
  const s = {
    leads: [{ id: "a", first: "Client" }],
    programmes: { a: { packageId: "inner-code-guided" } },
    intakes: {},
    workflow: {},
    outbox: {},
  };
  reconcileWorkflow(s, "2026-11-03", {
    "inner-code-guided": {
      nextSteps: "What Happens Next\n1. Your revised instructions.",
    },
  });
  assert.match(s.outbox["a:first"].body, /Your revised instructions/);
  s.outbox["a:first"].status = "Sent";
  reconcileWorkflow(s, "2026-11-03", {
    "inner-code-guided": { nextSteps: "Different instructions" },
  });
  assert.match(s.outbox["a:first"].body, /Your revised instructions/);
  assert.equal(content.nextText("custom-product"), "");
});
