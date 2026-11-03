import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { designedDocument } from "../lib/document-design-preview.mjs";
const [source, destination] = process.argv.slice(2);
if (!source || !destination)
  throw Error(
    "Usage: node scripts/preview-uploaded-documents.mjs source.json output-directory",
  );
const data = JSON.parse(await readFile(source, "utf8"));
await mkdir(destination, { recursive: true });
for (const kind of ["invoice", "agreement"]) {
  const pdf = await designedDocument(data[kind], kind);
  const path = resolve(destination, `Seek-by-Ritu-${kind}-Redesign.pdf`);
  await writeFile(path, pdf);
  console.log(path);
}
