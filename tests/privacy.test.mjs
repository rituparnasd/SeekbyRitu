import test from "node:test";
import assert from "node:assert/strict";
import {
  privacyText,
  privacyVersion,
  privacyInfo,
  privacySections,
  privacyHTML,
  coachingConsent,
} from "../lib/privacy.mjs";
test("the supplied policy is versioned and public without adding undisclosed database or backup location claims", () => {
  assert.equal(privacyInfo.effectiveDate, "November 3, 2026");
  assert.equal(privacySections.length, 10);
  assert.match(privacyVersion, /^[a-f0-9]{64}$/);
  assert.match(privacyText, /Oregon, United States/);
  assert(!/database.{0,20}Oregon/i.test(privacyText));
  assert(!/backups.{0,20}Oregon/i.test(privacyText));
  const html = privacyHTML();
  assert.match(html, /Privacy Policy/);
  assert.match(html, /href="\/privacy.pdf"/);
  assert.match(html, /Security/);
  assert(!html.includes("<script"));
});
test("sensitive coaching consent requires an explicit choice and the current policy version", () => {
  assert.throws(() => coachingConsent({}), /explicitly consent/);
  assert.throws(
    () =>
      coachingConsent({ coachingConsent: true, privacyVersion: "outdated" }),
    /current Privacy Policy/,
  );
  const record = coachingConsent({ coachingConsent: true, privacyVersion });
  assert.equal(record.policyVersion, privacyVersion);
  assert.equal(record.policyText, privacyText);
  assert.equal(record.coachingInformation, true);
  assert(record.consentedAt);
  assert(!record.marketingConsent);
});
