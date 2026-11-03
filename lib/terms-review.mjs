// Match unfinished drafting language, not a coach's completed review itself.
const markers =
  /(?:^|:)\s*to be provided\b|\bto be (?:agreed|confirmed)\b|suggested.{0,30}approval|\bmust be finali[sz]ed\b|terms.{0,20}pending|must (?:also )?be (?:agreed|confirmed)(?: in writing)? before (?:signing|enrollment|enrollment|this agreement is signed)|remains a review draft|outstanding terms and payment instructions are finali[sz]ed/i;
export function unresolvedTerms(text = "") {
  return String(text)
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => markers.test(line));
}
export function hasUnresolvedTerms(text = "") {
  return unresolvedTerms(text).length > 0;
}
export function termsReviewMessage(text = "") {
  const line =
    unresolvedTerms(text)[0] || "No Service Agreement text has been entered.";
  const match = line.match(markers);
  const start = Math.max(0, (match?.index || 0) - 80);
  const end = Math.min(
    line.length,
    (match?.index || 0) + (match?.[0].length || 0) + 180,
  );
  const excerpt =
    (start ? "…" : "") +
    line.slice(start, end) +
    (end < line.length ? "…" : "");
  return `Approval paused because this line still describes an unfinished term: “${excerpt}”\nReplace it with your final rule, or use Save As Draft to keep your edits without approving yet.`;
}
