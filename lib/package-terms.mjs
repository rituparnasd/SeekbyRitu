import "../public/programme-content.js";
export function packageTerms(pkg) {
  return globalThis.programmeContent.terms(
    typeof pkg === "string" ? pkg : pkg?.id || pkg?.packageId || "inner-code",
  );
}
