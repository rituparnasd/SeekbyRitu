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
test("all package review drafts remain blocked even when an approval box is checked", () => {
  for (const product of initialProducts(packageTerms("inner-code"))) {
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
      "The programme costs CAD 50. Accepted changes are confirmed in writing.",
    ),
    false,
  );
});

test("review warnings identify the actual unfinished phrase without blocking completed review language", () => {
  assert.equal(
    hasUnresolvedTerms(
      "Privacy processing must be explained before enrolment.",
    ),
    false,
  );
  assert.equal(
    hasUnresolvedTerms("The services to be provided include coaching."),
    false,
  );
  assert.equal(
    hasUnresolvedTerms("The privacy notice must be provided before enrolment."),
    false,
  );
  assert.equal(hasUnresolvedTerms("Business address: To be provided"), true);
  assert.equal(
    hasUnresolvedTerms("All outstanding terms have been agreed and approved."),
    false,
  );
  assert.match(
    termsReviewMessage(
      "Programme details. ".repeat(40) +
        "Cancellation must be agreed before signing.",
    ),
    /Cancellation must be agreed before signing/,
  );
  assert.match(
    termsReviewMessage("Payment timing to be confirmed."),
    /Save As Draft/,
  );
});
