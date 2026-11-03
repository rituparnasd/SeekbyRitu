import { mkdir, writeFile } from "node:fs/promises";
import "../public/packages.js";
import "../public/calendar.js";
import { packageTerms } from "../lib/package-terms.mjs";
import { pdfDocument } from "../lib/documents.mjs";
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
        : "Payment method and receiving instructions will be provided by Rituparna. Review the final Service Agreement before paying.";
    const buffer = await pdfDocument({
      kind,
      isTest: true,
      previewTerms: packageTerms(cfg.id),
      packageSnapshot: cfg,
      stage: cfg.deposit ? "deposit" : "balance",
      business,
      client: "Client Name",
      reference: "PREVIEW-" + cfg.id,
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
  "Generated six package-specific design previews. Drafts are not approved for sending.",
);
