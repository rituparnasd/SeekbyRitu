import test from "node:test";
import assert from "node:assert/strict";
import "../public/payment-links.js";
import { documentInput, initialProducts } from "../lib/billing.mjs";
import { reconcileWorkflow } from "../lib/workflow.mjs";
const payments = globalThis.innerCodePayments;
test("Stripe checkout links match exact CAD package instalments", () => {
  const expected = [
    ["inner-code-self-guided", 50, "28E7sLdFA44j8I6bRJ43S00"],
    ["inner-code-guided", 100, "aFa6oH6d8dET5vUg7Z43S01"],
    ["inner-code", 150, "eVq9AT5946cr9MaaNF43S02"],
    ["inner-code", 350, "00w00jdFAdETbUi3ld43S03"],
  ];
  for (const [id, amount, code] of expected) {
    assert.equal(payments.url(id, amount), "https://buy.stripe.com/" + code);
    assert.equal(payments.url(id, amount, "USD"), "");
    const body = {
      customer: { name: "Example", email: "example@example.com" },
      due: "2026-11-03",
      items: [
        { productId: id, price: amount, quantity: 1, tax: 0, discount: 0 },
      ],
    };
    const invoice = documentInput(body, initialProducts("Draft"), {});
    if (id === "inner-code")
      assert.match(invoice.payment, /Interac e-Transfer/);
    else assert.match(invoice.payment, new RegExp(code));
    assert.throws(
      () =>
        documentInput(
          {
            ...body,
            items: [{ ...body.items[0], price: amount + 1 }],
            payment: invoice.payment,
          },
          initialProducts("Draft"),
          {},
        ),
      /does not match/,
    );
    const s = {
      leads: [{ id: "a", first: "Example" }],
      programmes: { a: { packageId: id } },
      intakes: {},
      workflow: {},
      outbox: {},
    };
    reconcileWorkflow(s, "2026-11-03");
    if (amount !== 350) {
      if (id === "inner-code")
        assert.match(s.outbox["a:first"].body, /Interac e-Transfer/);
      else assert(s.outbox["a:first"].body.includes(payments.url(id, amount)));
    }
  }
  assert.equal(payments.url("inner-code", 500), "");
  assert.equal(payments.url("custom", 50), "");
});
