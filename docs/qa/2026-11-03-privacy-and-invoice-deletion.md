# Privacy and mistaken invoice deletion

Validation: all 54 tests pass, including browser deletion/restore, issued invoice deletion, payment protection, public policy routes and explicit current-policy onboarding consent. JavaScript syntax and whitespace checks pass. The branded privacy PDF has two pages.

Billing offers Delete Draft with Restore Draft, and confirmed permanent deletion of unpaid issued invoices. Linked payments/receipts and pending or uncertain email delivery prevent deletion. Deletion cannot recall email already delivered.

On the next production startup, a narrowly scoped cleanup removes IC-IS-SQEWVA-JWUWQY only if it matches CAD 50 and passes the same guards. Its result appears in verification diagnostics. No live database operation or Render deployment has been verified from this workspace.

The supplied policy is available at /privacy and /privacy.pdf before login. Its Oregon hosting statement is owner-provided, not an independently verified database or backup location. New questionnaire submissions require explicit versioned coaching-information consent. Historical submissions do not receive fabricated consent. First-step invoice emails include the policy PDF; no actual email was sent during tests.
