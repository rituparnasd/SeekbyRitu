import test from "node:test";
import assert from "node:assert/strict";
import { hasUnresolvedTerms } from "../lib/terms-review.mjs";
import { packageTerms } from "../lib/package-terms.mjs";
import {
  initialProducts,
  productInput,
  documentInput,
} from "../lib/billing.mjs";
test("all package review drafts remain blocked even when an approval box is checked", () => {
  for (const product of initialProducts(packageTerms("inner-code"))) {
    assert(hasUnresolvedTerms(product.terms));
    assert.throws(
      () => productInput({ ...product, approved: true }),
      /placeholder/,
    );
    assert.throws(
      () =>
        documentInput(
          {
            customer: { name: "Example", email: "example@example.com" },
            due: "2026-11-03",
            approved: true,
            requiresAgreement: true,
            terms: product.terms,
            items: [
              {
                productId: product.id,
                price: product.price,
                quantity: 1,
                tax: 0,
                discount: 0,
              },
            ],
          },
          [product],
          {},
        ),
      /Review/,
    );
  }
  for (const wording of [
    "Cancellation must be agreed before signing.",
    "Privacy processing must be explained before enrolment.",
    "This remains a review draft.",
  ])
    assert(hasUnresolvedTerms(wording));
  assert.equal(
    hasUnresolvedTerms(
      "The programme costs CAD 50. Accepted changes are confirmed in writing.",
    ),
    false,
  );
});
