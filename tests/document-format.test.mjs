import test from "node:test";
import assert from "node:assert/strict";
import "../public/document-format.js";
import { productInput, documentInput } from "../lib/billing.mjs";
const format = globalThis.documentFormat;
const delta = {
  ops: [
    { insert: "Read ", attributes: { font: "serif", size: "14pt" } },
    {
      insert: "carefully",
      attributes: {
        bold: true,
        italic: true,
        underline: true,
        strike: true,
        color: "#0b3027",
        background: "#fff3a3",
        script: "super",
      },
    },
    { insert: "\n", attributes: { align: "justify", lineheight: "1.5" } },
  ],
};
test("supported text formatting survives catalogue and invoice snapshots without HTML", () => {
  const p = productInput({
    name: "Workshop",
    price: 50,
    currency: "CAD",
    description: "Read carefully",
    terms: "Final rules.",
    approved: true,
    formatting: { description: delta },
  });
  assert.deepEqual(p.formatting.description, delta);
  const invoice = documentInput(
    {
      customer: { name: "Example", email: "example@example.com" },
      due: "2026-11-03",
      items: [
        {
          productId: "p",
          description: p.description,
          price: 50,
          quantity: 1,
          tax: 0,
        },
      ],
      terms: "Final rules.",
      approved: true,
      payment: "Pay as agreed.",
    },
    [{ ...p, id: "p" }],
    {},
  );
  assert.deepEqual(invoice.items[0].formatting.description, delta);
  assert.equal(format.plain(delta), "Read carefully");
  assert.equal(format.paragraphs(delta)[0].attributes.align, "justify");
});
test("format validation rejects embeds, mismatched text, unsafe styles and resource payloads", () => {
  for (const bad of [
    { ops: [{ insert: { image: "https://example.com/a.png" } }] },
    {
      ops: [
        {
          insert: "Read carefully\n",
          attributes: { color: "url(javascript:bad)" },
        },
      ],
    },
    { ops: [{ insert: "Read carefully\n", attributes: { onclick: "bad" } }] },
    {
      ops: [
        { insert: "Read carefully\n", attributes: { font: "arbitrary-css" } },
      ],
    },
    { ops: [{ insert: "Read carefully\n", attributes: { size: "999999pt" } }] },
    { ops: [{ insert: "different text\n" }] },
  ])
    assert.throws(() => format.normalize(bad, "Read carefully"));
  assert.equal(format.normalize(undefined, "plain"), undefined);
});
