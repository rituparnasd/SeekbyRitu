import test from "node:test";
import assert from "node:assert/strict";
import {
  hasUnresolvedTerms,
  termsReviewMessage,
} from "../lib/terms-review.mjs";
import { packageTerms } from "../lib/package-terms.mjs";
import {
  initialProducts,
  productInput,
  documentInput,
} from "../lib/billing.mjs";
test("owner-supplied final package terms pass; newly added unfinished terms still block approval", () => {
  for (const product of initialProducts(packageTerms("inner-code"))) {
    assert.equal(hasUnresolvedTerms(product.terms), false);
    assert.equal(productInput({ ...product, approved: true }).approved, true);
    product.terms += "\nCancellation must be agreed before signing.";
    assert(hasUnresolvedTerms(product.terms));
    assert.throws(
      () => productInput({ ...product, approved: true }),
      /Approval paused/,
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
      /Approval paused/,
    );
  }
  for (const wording of [
    "Cancellation must be agreed before signing.",
    "This remains a review draft.",
  ])
    assert(hasUnresolvedTerms(wording));
  assert.equal(
    hasUnresolvedTerms(
      "The program costs CAD 50. Accepted changes are confirmed in writing.",
    ),
    false,
  );
});

test("review warnings identify the actual unfinished phrase without blocking completed review language", () => {
  assert.equal(
    hasUnresolvedTerms(
      "Privacy processing must be explained before enrollment.",
    ),
    false,
  );
  assert.equal(
    hasUnresolvedTerms("The services to be provided include coaching."),
    false,
  );
  assert.equal(
    hasUnresolvedTerms("The privacy notice must be provided before enrollment."),
    false,
  );
  assert.equal(hasUnresolvedTerms("Business address: To be provided"), true);
  assert.equal(
    hasUnresolvedTerms("All outstanding terms have been agreed and approved."),
    false,
  );
  assert.match(
    termsReviewMessage(
      "Program details. ".repeat(40) +
        "Cancellation must be agreed before signing.",
    ),
    /Cancellation must be agreed before signing/,
  );
  assert.match(
    termsReviewMessage("Payment timing to be confirmed."),
    /Save As Draft/,
  );
});
