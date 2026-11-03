import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { database } from "../lib/database.mjs";
import { encryption } from "../lib/security.mjs";
import {
  americanEnglish,
  adoptAmericanEnglish,
} from "../lib/american-english.mjs";
import "../public/programme-content.js";

test("application copy and package snapshots use American English", () => {
  assert.equal(
    americanEnglish(
      "Personalised programme, enrolment, colour, behaviour, counselling. Cancelled. PERSONALISED.",
    ),
    "Personalized program, enrollment, color, behavior, counseling. Canceled. PERSONALIZED.",
  );
  const outdated = {
    packageId: "inner-code",
    packageSnapshot: {
      description: "A personalised programme",
      calls: 10,
      refundThreshold: 95,
    },
  };
  const cfg = globalThis.innerCodePackages.get(outdated);
  assert.equal(cfg.description, "A personalized program");
  assert.equal(cfg.calls, 10);
  assert.equal(
    outdated.packageSnapshot.description,
    "A personalised programme",
  );
  for (const p of globalThis.innerCodePackages.all) {
    const text = [
      p.description,
      globalThis.programmeContent.description(p.id),
      globalThis.programmeContent.nextText(p.id),
    ].join("\n");
    assert(!/\b(personalised|programme|enrolment|behaviour)\b/i.test(text));
  }
});

test("American spelling updates editable templates once and preserves issued documents and client entries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "seek-american-"));
  process.env.NODE_ENV = "test";
  process.env.TEST_DB_PATH = join(dir, "db");
  delete process.env.DATABASE_URL;
  const db = await database(),
    crypt = encryption(randomBytes(32).toString("base64"));
  try {
    const rows = [
      [
        "billing_catalogue",
        "p",
        {
          id: "p",
          version: 2,
          approved: true,
          description: "Personalised programme",
          terms: "Counselling is not included.",
          formatting: {
            description: {
              ops: [
                {
                  insert: "Personalised programme\n",
                  attributes: { bold: true },
                },
              ],
            },
          },
        },
      ],
      [
        "billing_documents",
        "draft",
        {
          id: "draft",
          version: 1,
          status: "Draft",
          terms: "Personalised programme",
          customer: { name: "Centre Client" },
        },
      ],
      [
        "billing_documents",
        "issued",
        {
          id: "issued",
          version: 1,
          status: "Issued",
          terms: "Personalised programme",
        },
      ],
      [
        "outbox",
        "draft",
        {
          id: "draft",
          status: "Draft",
          subject: "Your Programme",
          body: "Personalised programme",
          client: "person",
        },
      ],
      [
        "outbox",
        "sent",
        { id: "sent", status: "Sent", body: "Personalised programme" },
      ],
      ["intakes", "person", { answers: ["My favourite colour"] }],
    ];
    for (const [section, id, value] of rows)
      await db.query(
        "INSERT INTO documents(section,record_key,payload) VALUES(?,?,?)",
        [section, id, crypt.seal(value)],
      );
    const read = async (section, id) =>
      crypt.open(
        (
          await db.query(
            "SELECT payload FROM documents WHERE section=? AND record_key=?",
            [section, id],
          )
        )[0].payload,
      );
    await adoptAmericanEnglish(db, crypt);
    const p = await read("billing_catalogue", "p");
    assert.equal(p.description, "Personalized program");
    assert.equal(p.approved, true);
    assert.equal(p.version, 3);
    assert.equal(
      p.formatting.description.ops[0].insert,
      "Personalized program\n",
    );
    assert.equal(p.formatting.description.ops[0].attributes.bold, true);
    assert.equal(
      (await read("billing_documents", "draft")).customer.name,
      "Centre Client",
    );
    assert.equal(
      (await read("billing_documents", "issued")).terms,
      "Personalised programme",
    );
    assert.equal((await read("outbox", "sent")).body, "Personalised programme");
    assert.equal((await read("outbox", "draft")).body, "Personalized program");
    assert.equal(
      (await read("intakes", "person")).answers[0],
      "My favourite colour",
    );
    assert.equal(
      (await read("billing_catalogue_language_history", "p:2")).description,
      "Personalised programme",
    );
    await adoptAmericanEnglish(db, crypt);
    assert.equal((await read("billing_catalogue", "p")).version, 3);
  } finally {
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
