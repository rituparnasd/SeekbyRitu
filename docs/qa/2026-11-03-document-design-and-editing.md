# Document design and editing review

The uploaded invoice occupied two pages, with only its closing sentence on the second. The uploaded agreement occupied three pages, with acceptance and signatures on the third.

An isolated design-preview renderer and JSON-input preview script now demonstrate an invoice on one A4 page and the supplied full agreement on two A4 pages. The design uses the original logo, deep blue, dark green, clear amounts, quiet metadata and readable numbered sections. Wording, client details and payment instructions from the uploads are retained in the local review PDFs. All nine source clauses and invoice description/payment/notes were checked against extracted PDF text; page bounds and counts were verified and all pages visually inspected.

Preview files contain client information and are not committed to GitHub. The renderer is not connected to issued documents. Uploaded payment instructions are not used to override the live catalogue or the owner's configured checkout links. The uploaded agreement's 90% wording conflicts with the owner's confirmed 95% requirement; the unchanged preview is a design draft, not a contract ready to issue.

Billing and Products & Services now have an accessible toolbar on their text fields: bullets, numbered lists, indent/outdent, undo/redo, automatic list continuation and empty-point exit. Selection changes apply only to complete selected lines. Values remain plain text in existing form fields and encrypted storage. No arbitrary HTML is introduced. Long agreement list items retain hanging indentation in PDF paragraphs. These controls are not a full rich-text editor; bold, italic and arbitrary fonts are not added by this change.

The toolbar uses Tab/Shift+Tab for indentation and documents Escape followed by Tab for leaving the editor. Undo/redo history is local to the mounted field; saving and reopening reloads saved text, not its undo stack. Toolbar actions are type=button, and form submission continues to target the save button.

Validation: 39 local tests passed, including browser toolbar interaction, list continuation, undo, persisted invoice workflows and responsive views at existing tested widths. Pure list-editing tests verify selected-range boundaries, toggle semantics, numbering and blank list exits. No real email, charge or deployment verification was performed by these tests.
