import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
export const privacyText = await readFile(
  new URL("../docs/policies/privacy-policy.md", import.meta.url),
  "utf8",
);
export const privacyVersion = createHash("sha256")
  .update(privacyText)
  .digest("hex");
export const privacyInfo = {
  version: privacyVersion,
  effectiveDate: "November 3, 2026",
  href: "/privacy",
  pdf: "/privacy.pdf",
};
export const privacyConsentText =
  "I explicitly consent to the use of the coaching information I choose to share, including potentially sensitive information about Health, Relationships, Career, Money and Spirituality, to personalize, deliver and administer my program. I have read the Privacy Policy. Marketing permission is separate.";
export function coachingConsent(input) {
  if (input.privacyVersion !== privacyVersion || input.coachingConsent !== true)
    throw Object.assign(
      Error(
        "Please read the current Privacy Policy and explicitly consent before saving coaching information.",
      ),
      { status: 409 },
    );
  return {
    policyVersion: privacyVersion,
    policyText: privacyText,
    statement: privacyConsentText,
    consentedAt: new Date().toISOString(),
    coachingInformation: true,
  };
}
export const privacySections = [];
for (const block of privacyText.split(/\n\s*\n/)) {
  const heading = block.trim().match(/^\*\*(\d+)\. (.+?)\*\*$/);
  if (heading)
    privacySections.push({
      number: Number(heading[1]),
      title: heading[2],
      paragraphs: [],
    });
  else if (privacySections.length)
    for (const line of block.trim().split("\n"))
      privacySections.at(-1).paragraphs.push({
        text: line.replace(/^-\s*/, ""),
        bullet: /^-\s/.test(line),
      });
}
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const inline = (s) =>
  escape(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
export function privacyHTML() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Privacy Policy · Seek by Ritu</title><link rel="stylesheet" href="/style.css"><link rel="icon" href="/assets/seekbyritu-logo.png"></head><body><main class="privacy-page"><header class="privacy-heading"><img src="/assets/seekbyritu-logo.png" alt="Seek by Ritu"><div><p class="eyebrow">Seek by Ritu</p><h1>Privacy Policy</h1><p>Effective date: ${privacyInfo.effectiveDate}</p></div></header><nav class="actions" aria-label="Policy actions"><a class="btn" href="/">Open CRM</a><a class="btn" href="/privacy.pdf">Download PDF</a></nav>${privacySections.map((section) => `<section><h2>${section.number}. ${escape(section.title)}</h2>${section.paragraphs.map((p) => (p.bullet ? `<p class="privacy-bullet">${inline(p.text)}</p>` : `<p>${inline(p.text)}</p>`)).join("")}</section>`).join("")}<footer><a href="mailto:seekbyritu@gmail.com">seekbyritu@gmail.com</a></footer></main></body></html>`;
}
export async function privacyPDF() {
  const { referenceDocumentPDF } = await import("./reference-documents.mjs");
  return referenceDocumentPDF(
    {
      documentLabel: "Privacy Policy",
      effectiveDate: privacyInfo.effectiveDate,
      sections: privacySections,
    },
    "policy",
  );
}
