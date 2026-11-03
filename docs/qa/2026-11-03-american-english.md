# American English standard

All application-authored UI copy, onboarding prompts, notifications, email defaults and document templates use American English. Examples include personalized, program, enrollment, authorization, counseling, customize, color and acknowledgment. The page language is en-US. Calgary/India time zones, CAD currency and scheduling rules are unchanged.

A one-time production startup migration updates current editable catalogue templates, draft billing copy and draft emails. It preserves formatting, approval flags, amounts and business conditions; prior versions are retained encrypted. Client identities, questionnaire answers, journals, sent messages, signatures and issued financial records are not rewritten. Historical package descriptions are normalized when used for new documents without rewriting the stored snapshot or entitlements. Existing database keys and API fields remain compatible.

Validation: full regression suite (57 tests), including browser flow and migration preservation/idempotency; JavaScript syntax checks; downloadable draft and package PDF text checked for old spellings. No Render deployment or actual inbox delivery was independently verified. Future edits must follow the American English rule recorded in AGENTS.md.
