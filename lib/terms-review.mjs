// Catch the actual draft markers in package templates before issuing client contracts.
export function hasUnresolvedTerms(text = "") {
  return /to be (agreed|provided|confirmed)|suggested.{0,30}approval|must be finalised|terms.{0,20}pending|must be (agreed|confirmed|explained) before (signing|enrolment)|remains a review draft|outstanding terms/i.test(
    text,
  );
}
