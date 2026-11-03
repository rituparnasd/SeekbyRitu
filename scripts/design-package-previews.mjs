import { mkdir, writeFile } from "node:fs/promises";
import "../public/packages.js";
import "../public/payment-links.js";
import "../public/programme-content.js";
import "../public/calendar.js";
import { packageTerms } from "../lib/package-terms.mjs";
import { pdfDocument } from "../lib/documents.mjs";
import { documentReference } from "../lib/document-references.mjs";
const dir = new URL("../docs/previews/packages/", import.meta.url);
await mkdir(dir, { recursive: true });
const business = {
  name: "Rituparna Das / BLINDSPOT STUDIOS",
  currency: "CAD",
  publicAddress: "",
};
for (const cfg of globalThis.innerCodePackages.all) {
  for (const kind of ["agreement", "invoice"]) {
    const body =
      kind === "agreement"
        ? packageTerms(cfg.id)
        : globalThis.programmeContent.payment(cfg.id, cfg.deposit || cfg.price);
    const buffer = await pdfDocument({
      kind,
      isTest: true,
      previewTerms: packageTerms(cfg.id),
      packageSnapshot: cfg,
      stage: cfg.deposit ? "deposit" : "balance",
      business,
      client: "Client Name",
      customerEmail: "client@example.com",
      customerPhone: "Client phone",
      agreementDate: globalThis.coachingTime.today(),
      reference: documentReference(cfg.id),
      amount: cfg.deposit || cfg.price,
      date:
        globalThis.coachingTime?.today?.() ||
        new Date().toISOString().slice(0, 10),
      body,
    });
    await writeFile(new URL(`${cfg.id}-${kind}-PREVIEW.pdf`, dir), buffer);
  }
}
console.log(
  "Generated six package-specific samples. These are not real invoices or signed client agreements.",
);
