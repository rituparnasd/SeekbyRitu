# Client–Billing synchronization and communications

## Behavior

New linked program invoices and verified receipts use the same saved Billing record from Client downloads, Billing previews and program email attachments. New invoices and receipts have separate nonsequential references, with an explicit invoice reference on the receipt. Existing historical references are preserved. Client verification populates the shared ledger; Billing verification updates the linked program's payment flags without bypassing questionnaire, plan review or activation requirements. Matching is limited to one registered client, one known package and its exact payment stage. Duplicate linked invoices, repeat payment references and replacement of paid invoices are blocked. Unpaid explicit revisions preserve the previous invoice and mark its replacement.

Historical unlinked Billing and Client documents are not silently reconciled. The Client Communications section provides a read-only financial comparison and flags potentially overlapping receipts or conflicts. Shweta's live documents have not been read, renumbered, deleted or reconciled from this workspace. Selecting an official historical set requires the owner's separate review/approval.

Client → Communications & Internal Notes supports private Email/WhatsApp/Phone/Meeting summaries, reasons, optional replacement references, next actions and due dates. Sent status remains Sent; Superseded is a separate annotation. Discarded is allowed only for unsent drafts, and annotated obsolete emails are blocked from sending. Communication follow-ups appear on Today's Work and can be completed. WhatsApp messages and external calls are not automatically imported.

Document events retain future draft/issue/payment/deletion history. Related email records are archived before an unpaid mistaken invoice is deleted, so communications can retain their context while the invoice disappears from Billing. This cannot recover history deleted by older releases. New email deliveries retain exact attached document references alongside the provider snapshot; no historical attachment reference is invented.

Habit completion remains honest self-reporting. No evidence uploads, Drive links, mandatory proof or coach evidence-approval gate has been introduced. Client guidance and progress-report copy identify self-reported activity. Existing calls, packages, scores and refund conditions remain unchanged.

## Validation

60 tests passed, including the browser full-payment flow, identical Client/Billing receipt reference, communication-note persistence, ledger idempotency, Billing-to-Client payment flags, historical conflict preservation, sent-email annotations, follow-up completion and archived email retention after invoice deletion. Existing security, package, report, calendar and onboarding regression checks remain included. JavaScript syntax and whitespace checks pass.

Tests use fictional local records. No actual customer email or payment was sent/processed. Production Render deployment, Shweta's database records and actual inbox delivery have not been independently verified.
