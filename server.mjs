import { addTestClient } from "./lib/test-client.mjs";
import { LoginLimiter } from "./lib/login-limiter.mjs";
import { setupDiagnosis } from "./lib/setup-diagnostics.mjs";
import {
  gmailAddress,
  gmailScope,
  sendGmail,
  refreshGmail,
} from "./lib/mail.mjs";
import http from "node:http";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
const digestBase64 = (value) =>
  createHash("sha256").update(value).digest("base64url");
import { database } from "./lib/database.mjs";
import {
  encryption,
  randomToken,
  digest,
  hashPassword,
  checkPassword,
  mfaSecret,
  verifyTotp,
  constantEqual,
} from "./lib/security.mjs";
import { reconcileWorkflow } from "./lib/workflow.mjs";
import { reportData, reportPDF } from "./lib/reports.mjs";
import { pdfDocument, agreementText } from "./lib/documents.mjs";
import { billingStore, billingPDF } from "./lib/billing.mjs";
import "./public/intake.js";
import { innerCodeTerms } from "./lib/inner-code-terms.mjs";
const origin = process.env.APP_ORIGIN || "",
  production = process.env.NODE_ENV !== "test";
const required = [
  "DATABASE_URL",
  "DATA_ENCRYPTION_KEY",
  "OWNER_SETUP_TOKEN",
  "APP_ORIGIN",
];
const missing = required.filter(
  (k) =>
    !process.env[k] &&
    !(k === "DATABASE_URL" && !production && process.env.TEST_DB_PATH),
);
let db,
  crypt,
  initError = false,
  setupDiagnostic = null;
if (!missing.length) {
  let stage = "encryption";
  try {
    crypt = encryption(process.env.DATA_ENCRYPTION_KEY);
    stage = "database";
    db = await database();
  } catch (error) {
    initError = true;
    setupDiagnostic = setupDiagnosis(stage, error);
    console.error("Storage setup failed: " + setupDiagnostic.code);
  }
}
const sections = [
  "leads",
  "programmes",
  "practicePlans",
  "practiceTicks",
  "dailyMaterials",
  "materialProgress",
  "intakes",
  "customPlans",
  "localizedEdits",
  "records",
  "journals",
  "checkins",
  "agreements",
  "notes",
  "workflow",
  "outbox",
];
const business = {
  name: process.env.BUSINESS_LEGAL_NAME || "Rituparna Das / BLINDSPOT STUDIOS",
  registration: process.env.BUSINESS_REGISTRATION || "TN28592426",
  address:
    process.env.BUSINESS_ADDRESS ||
    "Unit 706, 342 15 Avenue SW, Calgary, AB T2R 0P9, Canada",
  currency: process.env.BUSINESS_CURRENCY || "CAD",
  publicAddress: process.env.PUBLIC_BUSINESS_ADDRESS || "",
};
const emailProvider = process.env.EMAIL_PROVIDER || "gmail";
const googleClient = {
  id: process.env.GOOGLE_CLIENT_ID || "",
  secret: process.env.GOOGLE_CLIENT_SECRET || "",
};
async function gmailConnection() {
  const rows = await db.query(
    "SELECT value FROM metadata WHERE name='gmail_connection'",
  );
  return rows[0] ? crypt.open(rows[0].value) : null;
}
async function storeGmail(value) {
  await db.query(
    "INSERT INTO metadata(name,value) VALUES('gmail_connection',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value",
    [crypt.seal(value)],
  );
}
async function mailConfigured() {
  return emailProvider === "gmail"
    ? !!(
        db &&
        googleClient.id &&
        googleClient.secret &&
        (await gmailConnection())?.refreshToken
      )
    : !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}
const finalTerms = process.env.FINAL_PROGRAMME_TERMS || "";
async function approvedProgrammeTerms() {
  const rows = await db.query(
    "SELECT payload FROM documents WHERE section='billing_catalogue' AND record_key='inner-code'",
  );
  const product = rows[0] ? crypt.open(rows[0].payload) : null;
  return product?.approved &&
    product.terms &&
    !/to be (agreed|provided|confirmed)|suggested.{0,30}approval|must be finalised|terms.{0,20}pending/i.test(
      product.terms,
    )
    ? product.terms
    : finalTerms;
}
async function requireFullPayment(id) {
  const p = (await stateRead()).programmes[id];
  if (!p?.deposit || !p?.balance)
    fail(
      403,
      "Your account opens after the full CAD 500 payment has been verified. Use your private onboarding link before then.",
    );
}
async function onboardingLink(id) {
  const token = randomToken();
  const record = {
    client: id,
    expires: new Date(Date.now() + 7 * 86400000).toISOString(),
  };
  await db.query(
    "INSERT INTO documents(section,record_key,payload) VALUES('onboarding_links',?,?)",
    [digest(token), crypt.seal(record)],
  );
  return origin + "/?onboarding=" + token;
}
const responses = new AsyncLocalStorage();
let serial = Promise.resolve();
const exclusive = (fn) => {
  const p = serial.then(async () => {
    const pending = [];
    const value = await responses.run(pending, () => db.transaction(fn));
    for (const send of pending) send();
    return value;
  });
  serial = p.catch(() => {});
  return p;
};
const day = () => new Date().toISOString().slice(0, 10);
const emailHash = (email) => digest(email.toLowerCase().trim());
const fail = (status, message) => {
  throw Object.assign(Error(message), { status });
};
function json(res, status, value) {
  const pending = responses.getStore();
  if (pending) {
    pending.push(() =>
      responses.run(undefined, () => json(res, status, value)),
    );
    return;
  }
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}
async function body(req) {
  let bytes = 0,
    data = "";
  for await (const b of req) {
    bytes += b.length;
    if (bytes > 2 * 1024 * 1024) fail(413, "Request is too large");
    data += b;
  }
  try {
    const v = JSON.parse(data || "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) throw Error();
    return v;
  } catch {
    fail(400, "Invalid JSON body");
  }
}
function clean(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(clean);
  const out = Object.create(null);
  for (const [k, v] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(k))
      fail(400, "Invalid property");
    out[k] = clean(v);
  }
  return out;
}
async function account(id) {
  const r = await db.query("SELECT payload FROM accounts WHERE id=?", [id]);
  return r[0] ? crypt.open(r[0].payload) : null;
}
async function saveAccount(a) {
  await db.query(
    "INSERT INTO accounts(id,email_hash,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET email_hash=excluded.email_hash,payload=excluded.payload",
    [a.id, emailHash(a.email), crypt.seal(a)],
  );
}
async function stateRead() {
  const rows = await db.query(
      "SELECT section,record_key,payload FROM documents",
    ),
    s = Object.fromEntries(sections.map((k) => [k, k === "leads" ? [] : {}]));
  for (const r of rows) {
    const v = crypt.open(r.payload);
    if (r.section === "leads") s.leads.push(v);
    else if (sections.includes(r.section)) s[r.section][r.record_key] = v;
  }
  return s;
}
async function revision() {
  return Number(
    (await db.query("SELECT value FROM metadata WHERE name='revision'"))[0]
      ?.value || 0,
  );
}
async function stateWrite(s) {
  reconcileWorkflow(s);
  for (const [id, journals] of Object.entries(s.journals))
    for (const [kind, entry] of Object.entries(journals)) {
      if (!["daily", "learn"].includes(kind) || !entry?.at) continue;
      const date = String(entry.at).slice(0, 10);
      await db.query(
        "INSERT INTO journal_entries(id,client_id,entry_date,kind,payload) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
        [id + ":" + date + ":" + kind, id, date, kind, crypt.seal(entry)],
      );
    }
  for (const section of sections) {
    const entries =
      section === "leads"
        ? (s.leads || []).map((l) => [l.id, l])
        : Object.entries(s[section] || {});
    const existing = await db.query(
      "SELECT record_key,payload FROM documents WHERE section=?",
      [section],
    );
    const keep = new Set(entries.map(([k]) => k));
    for (const row of existing)
      if (!keep.has(row.record_key))
        await db.query(
          "DELETE FROM documents WHERE section=? AND record_key=?",
          [section, row.record_key],
        );
    for (const [key, value] of entries) {
      const previous = existing.find((r) => r.record_key === key);
      if (
        previous &&
        JSON.stringify(crypt.open(previous.payload)) === JSON.stringify(value)
      )
        continue;
      await db.query(
        "INSERT INTO documents(section,record_key,payload) VALUES(?,?,?) ON CONFLICT(section,record_key) DO UPDATE SET payload=excluded.payload",
        [section, key, crypt.seal(value)],
      );
    }
  }
  const v = (await revision()) + 1;
  await db.query(
    "INSERT INTO metadata(name,value) VALUES('revision',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value",
    [String(v)],
  );
  return v;
}
async function audit(actor, action) {
  await db.query("INSERT INTO audit(id,actor,action,created) VALUES(?,?,?,?)", [
    randomUUID(),
    actor,
    action,
    new Date().toISOString(),
  ]);
}
function active(s, id) {
  const p = s.programmes[id];
  return p?.balance && p.status === "Active" && p.start <= day();
}
function materialIndex(s, id) {
  if (!active(s, id)) return -1;
  const p = s.programmes[id],
    n = Math.min(
      30,
      Math.floor((Date.parse(day()) - Date.parse(p.start)) / 86400000) + 1,
    );
  let i = 0;
  while (i < n - 1 && s.materialProgress[id]?.[i]?.approved) i++;
  return i;
}
function scope(s, a) {
  if (a.role === "coach") return s;
  const id = a.id,
    access = active(s, id),
    result = Object.fromEntries(
      sections.map((k) => [k, k === "leads" ? [] : {}]),
    );
  result.leads = s.leads
    .filter((l) => l.id === id)
    .map(({ id, first, last, goal, identity, difficulty, isTest }) => ({
      id,
      first,
      last,
      isTest,
      ...(access ? { goal, identity, difficulty } : {}),
    }));
  for (const section of ["programmes", "workflow", "intakes", "agreements"])
    if (s[section][id]) result[section][id] = structuredClone(s[section][id]);
  if (result.workflow[id]) {
    const w = result.workflow[id];
    result.workflow[id] = {
      slots: w.slots,
      booking: w.booking,
      walkthroughDone: w.walkthroughDone,
    };
  }
  if (!access) return result;
  for (const section of [
    "practicePlans",
    "materialProgress",
    "customPlans",
    "localizedEdits",
    "journals",
  ])
    if (s[section][id]) result[section][id] = s[section][id];
  for (const section of ["practiceTicks", "records", "checkins"])
    for (const [k, v] of Object.entries(s[section]))
      if (k.startsWith(id + ":")) result[section][k] = v;
  const idx = materialIndex(s, id);
  if (s.dailyMaterials[id])
    result.dailyMaterials[id] = s.dailyMaterials[id].map((v, i) =>
      i <= idx ? v : { title: "Material Locked", locked: true },
    );
  return result;
}

function mergeTree(current, next, prior) {
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (equal(next, prior) || equal(next, current)) return current;
  const object = (v) => v && typeof v === "object" && !Array.isArray(v);
  if (
    object(next) &&
    (!prior || object(prior)) &&
    (!current || object(current))
  ) {
    const out = { ...(current || {}) };
    for (const k of new Set([
      ...Object.keys(prior || {}),
      ...Object.keys(next),
    ])) {
      const value = mergeTree(current?.[k], next[k], prior?.[k]);
      if (value === undefined) delete out[k];
      else out[k] = value;
    }
    return out;
  }
  if (!equal(current, prior))
    fail(
      409,
      "This record changed on another device. Reload before editing it.",
    );
  return next;
}
function changedPatch(old, incoming, base, coach) {
  const result = coach ? structuredClone(old) : structuredClone(incoming);
  const allowed = coach
    ? sections
    : [
        "records",
        "practiceTicks",
        "checkins",
        "journals",
        "materialProgress",
        "workflow",
        "intakes",
      ];
  for (const section of allowed) {
    const map = (v) =>
      section === "leads"
        ? Object.fromEntries((v || []).map((l) => [l.id, l]))
        : v || {};
    const merged = mergeTree(
      map(old[section]),
      map(incoming[section]),
      map(base?.[section]),
    );
    if (coach)
      result[section] = section === "leads" ? Object.values(merged) : merged;
    else {
      result[section] = {};
      for (const [k, v] of Object.entries(map(incoming[section])))
        if (JSON.stringify(v) !== JSON.stringify(map(base?.[section])[k]))
          result[section][k] = merged[k];
    }
  }
  return result;
}
async function mergeClient(old, incoming, a) {
  const id = a.id,
    s = structuredClone(old),
    access = active(s, id);
  for (const section of [
    "notes",
    "outbox",
    "customPlans",
    "programmes",
    "leads",
  ]) {
    if (
      JSON.stringify(incoming[section]) !==
      JSON.stringify(scope(old, a)[section])
    ) {
      /* These fields are ignored; never trusted from client. */
    }
  }
  if (incoming.intakes?.[id] && !s.intakes[id]?.submitted) {
    if (!s.programmes[id]?.deposit) fail(403, "Deposit confirmation required");
    const v = incoming.intakes[id];
    if (
      !Array.isArray(v.answers) ||
      v.answers.length !== 30 ||
      v.answers.some((x) => typeof x !== "string" || x.length > 10000)
    )
      fail(400, "Invalid questionnaire");
    s.intakes[id] = {
      answers: v.answers,
      updated: new Date().toISOString(),
      submitted: v.submitted ? new Date().toISOString() : null,
    };
    if (s.intakes[id].submitted && v.answers.some((x) => !x.trim()))
      fail(400, "All answers are required");
  }
  const proposed = incoming.workflow?.[id]?.booking;
  if (proposed && !s.workflow[id]?.booking) {
    const w = s.workflow[id];
    if (
      !w?.slots?.some(
        (x) => x.date === proposed.date && x.time === proposed.time,
      ) ||
      proposed.date < day()
    )
      fail(400, "Slot is not available");
    for (const [other, ow] of Object.entries(s.workflow)) {
      if (
        other !== id &&
        ow.booking?.date === proposed.date &&
        Math.abs(timeMinutes(ow.booking.time) - timeMinutes(proposed.time)) < 30
      )
        fail(409, "Slot was already booked");
      const block = ow.workBlock;
      if (
        block &&
        !ow.planReady &&
        block.date === proposed.date &&
        timeMinutes(proposed.time) <
          timeMinutes(block.time) + (block.duration || 60) &&
        timeMinutes(proposed.time) + 30 > timeMinutes(block.time)
      )
        fail(409, "Slot overlaps a work block");
    }
    for (const p of Object.values(s.programmes)) {
      if (p.status !== "Active") continue;
      for (const call of p.calls || [])
        if (
          call.date === proposed.date &&
          timeMinutes(proposed.time) < timeMinutes(call.time) + 20 &&
          timeMinutes(proposed.time) + 30 > timeMinutes(call.time)
        )
          fail(409, "Slot overlaps a coaching call");
    }
    s.workflow[id].booking = { date: proposed.date, time: proposed.time };
  }
  if (!access) return s;
  for (const section of ["records", "practiceTicks", "checkins"])
    for (const [k, v] of Object.entries(incoming[section] || {})) {
      if (!k.startsWith(id + ":")) continue;
      if (k.split(":")[1] !== day()) continue;
      s[section][k] = v;
    }
  if (incoming.journals?.[id]) {
    s.journals[id] ??= {};
    for (const kind of ["daily", "learn"]) {
      const v = incoming.journals[id][kind];
      if (!v || JSON.stringify(v) === JSON.stringify(s.journals[id][kind]))
        continue;
      s.journals[id][kind] = {
        body: String(v.body || "").slice(0, 20000),
        application: String(v.application || "").slice(0, 5000),
        outcome: String(v.outcome || "").slice(0, 5000),
        at: new Date().toISOString(),
      };
    }
  }
  for (const [k, v] of Object.entries(incoming.materialProgress?.[id] || {})) {
    const i = Number(k);
    if (i > materialIndex(s, id) || i < 0 || !Number.isInteger(i)) continue;
    if (s.materialProgress[id]?.[k]?.approved) continue;
    const m = s.dailyMaterials[id]?.[i];
    if (
      !m ||
      m.locked ||
      !v.learning?.trim() ||
      !v.application?.trim() ||
      !v.review?.trim()
    )
      continue;
    s.materialProgress[id] ??= {};
    s.materialProgress[id][k] = {
      learning: String(v.learning).slice(0, 5000),
      application: String(v.application).slice(0, 5000),
      review: String(v.review).slice(0, 5000),
      submitted: new Date().toISOString(),
      approved: !m.coachReview,
    };
  }
  return s;
}
const timeMinutes = (v) => {
  const [h, m] = String(v).split(":").map(Number);
  return h * 60 + m;
};
async function session(req) {
  const value = /seek_session=([^;]+)/.exec(req.headers.cookie || "")?.[1];
  if (!value) return null;
  const rows = await db.query("SELECT * FROM sessions WHERE token_hash=?", [
    digest(value),
  ]);
  if (!rows[0] || rows[0].expires < new Date().toISOString()) return null;
  const a = await account(rows[0].user_id);
  return a ? { ...rows[0], account: a } : null;
}
async function newSession(res, a) {
  const token = randomToken(),
    csrf = randomToken(),
    expires = new Date(Date.now() + 8 * 3600000).toISOString();
  await db.query(
    "INSERT INTO sessions(token_hash,user_id,csrf,expires) VALUES(?,?,?,?)",
    [digest(token), a.id, csrf, expires],
  );
  res.setHeader(
    "Set-Cookie",
    `seek_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${production ? "; Secure" : ""}`,
  );
  return csrf;
}
const loginLimiter = new LoginLimiter();
function loginBlocked(seconds) {
  throw Object.assign(
    Error(
      "Too many incorrect sign-in attempts. Try again when the countdown ends.",
    ),
    { status: 429, retryAfter: seconds },
  );
}
function loginFailure(key) {
  const wait = loginLimiter.failure(key);
  if (wait) loginBlocked(wait);
  fail(401, "Email, password or authenticator code is incorrect");
}
const attempts = new Map();
function rateLimit(key) {
  const now = Date.now();
  let item = attempts.get(key);
  if (!item || item.until < now) {
    item = { count: 0, until: now + 15 * 60000 };
    attempts.set(key, item);
  }
  if (++item.count > 12)
    fail(429, "Too many attempts. Try again in 15 minutes.");
  if (attempts.size > 5000)
    for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
}
async function invitation(id) {
  await requireFullPayment(id);
  const a = await account(id);
  if (!a) fail(404, "Client account not found");
  const token = randomToken();
  await db.query("DELETE FROM invitations WHERE user_id=?", [id]);
  await db.query(
    "INSERT INTO invitations(token_hash,user_id,expires) VALUES(?,?,?)",
    [digest(token), id, new Date(Date.now() + 48 * 3600000).toISOString()],
  );
  return origin + "/?invite=" + token;
}
async function ensureAccounts(s) {
  for (const l of s.leads) {
    if (!l.id || !l.email) continue;
    const a = await account(l.id);
    if (!a)
      await saveAccount({
        id: l.id,
        email: l.email.toLowerCase().trim(),
        role: "client",
        password: null,
        created: new Date().toISOString(),
      });
  }
}
async function financialRecord(s, id, kind, stage) {
  const finalTerms = await approvedProgrammeTerms();
  const l = s.leads.find((l) => l.id === id);
  if (!l) fail(404, "Client not found");
  const version =
    kind === "agreement" ? ":" + digest(finalTerms || "draft").slice(0, 8) : "";
  const reference =
    "SEEK-" +
    digest(id + ":" + stage + ":" + kind + version)
      .slice(0, 12)
      .toUpperCase();
  const rows = await db.query(
    "SELECT payload FROM financial_documents WHERE id=?",
    [reference],
  );
  if (rows[0]) return crypt.open(rows[0].payload);
  const record = {
    kind,
    isTest: !!l.isTest,
    business,
    client: l.first + " " + l.last,
    reference,
    amount: stage === "deposit" ? 150 : 350,
    paymentDetails: s.programmes[id]?.paymentDetails?.[stage],
    date: (
      s.programmes[id]?.paymentDetails?.[stage]?.date ||
      s.programmes[id]?.verifiedAt?.[stage] ||
      new Date().toISOString()
    ).slice(0, 10),
    body: l.isTest
      ? "FICTIONAL TRAINING RECORD — No payment was collected. Not a real invoice, receipt or signed agreement."
      : kind === "agreement"
        ? finalTerms
        : kind === "receipt"
          ? "Payment manually verified by coach. This is not a payment processor verification."
          : "Payment instructions: " +
            (process.env.PAYMENT_INSTRUCTIONS ||
              "Pending. Do not pay until final terms are agreed."),
  };
  if (
    !l.isTest &&
    business.name &&
    business.address &&
    business.currency &&
    finalTerms
  )
    await db.query(
      "INSERT INTO financial_documents(id,payload) VALUES(?,?) ON CONFLICT(id) DO NOTHING",
      [reference, crypt.seal(record)],
    );
  return record;
}
async function prepareEmail(id, actor) {
  const finalTerms = await approvedProgrammeTerms();
  const state = await stateRead(),
    e = state.outbox[id];
  if (!e) fail(404, "Message not found");
  if (["billing", "billingreceipt"].includes(e.type)) {
    const record = [
      ...(await billingStore(db, crypt, finalTerms).documents()),
      ...(await billingStore(db, crypt, finalTerms).payments()),
    ].find((d) => d.id === e.documentId);
    if (
      !record ||
      !["Issued", "Receipt"].includes(record.status) ||
      !record.approved
    )
      fail(
        409,
        "Issue the reviewed invoice and Service Agreement before emailing",
      );
    if (
      state.leads.some(
        (l) => l.isTest && l.email.toLowerCase() === record.customer.email,
      ) ||
      /\.(invalid|test)$/.test(record.customer.email)
    )
      fail(409, "Live email is disabled for test customers");
    if (!(await mailConfigured()))
      fail(503, "Connect the email provider in Email Center");
    const previous = (
      await db.query("SELECT payload FROM deliveries WHERE id=?", [id])
    )[0];
    if (previous) {
      const delivery = crypt.open(previous.payload);
      if (delivery.status === "Sent") return { status: "Already Sent" };
      if (["Unknown", "Pending"].includes(delivery.status))
        fail(
          409,
          "Check Gmail Sent and resolve the pending or uncertain delivery before retrying",
        );
    }
    const mail = {
      from: emailProvider === "gmail" ? gmailAddress : process.env.EMAIL_FROM,
      reply_to: gmailAddress,
      to: [record.customer.email],
      subject: `${record.status === "Receipt" ? "Payment Receipt" : "Your Documents"} — ${record.reference}`,
      text:
        record.status === "Receipt"
          ? `Hello ${record.customer.name},\n\nYour payment receipt is attached.\nReceived: ${record.currency} ${(record.receipt.amount / 100).toFixed(2)}\nRemaining: ${record.currency} ${((record.total - record.receipt.received) / 100).toFixed(2)}\n\n${record.business.name}`
          : `Hello ${record.customer.name},\n\nPlease review your attached invoice${record.requiresAgreement === false ? "" : " and Service Agreement"}.\nTotal: ${record.currency} ${(record.total / 100).toFixed(2)}\nDue: ${record.due}\n\n${record.payment}\n\n${record.business.name}`,
      attachments: [],
    };
    for (const kind of record.status === "Receipt"
      ? ["receipt"]
      : record.requiresAgreement === false
        ? ["invoice"]
        : ["invoice", "agreement"])
      mail.attachments.push({
        filename: `${record.reference}-${kind}.pdf`,
        content: (await billingPDF(record, kind)).toString("base64"),
      });
    await db.query(
      "INSERT INTO deliveries(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      [id, crypt.seal({ status: "Pending", mail })],
    );
    return { mail };
  }
  if (state.leads.some((l) => l.id === e.client && l.isTest))
    fail(409, "Live email is disabled for test clients.");
  if (!(await mailConfigured()))
    fail(
      503,
      emailProvider === "gmail"
        ? "Connect seekbyritu@gmail.com in Email Center after configuring Google OAuth credentials."
        : "Configure verified email provider in Render",
    );
  if (finalTerms.length > 20000)
    fail(409, "Keep programme terms within 20000 characters");
  if (!business.name || !business.address || !business.currency || !finalTerms)
    fail(
      409,
      "Finalise business details and programme terms before real enrollment emails",
    );
  if (e.due > day() || ["Paused", "Cancelled"].includes(e.status))
    fail(409, "Message is not due");
  const lead = state.leads.find((l) => l.id === e.client);
  if (!lead?.email) fail(400, "Client email missing");
  if (lead.isTest) fail(409, "Live email is disabled for test clients.");
  const previous = await db.query("SELECT payload FROM deliveries WHERE id=?", [
    id,
  ]);
  if (previous[0] && crypt.open(previous[0].payload).status === "Unknown")
    fail(
      409,
      "Check Gmail Sent and resolve the uncertain delivery before retrying",
    );
  if (previous[0] && crypt.open(previous[0].payload).status === "Sent")
    return { status: "Already Sent" };
  if (previous[0]) {
    const pending = crypt.open(previous[0].payload);
    if (pending.mail) return { mail: pending.mail };
  }
  let link = "";
  if (["paid"].includes(e.type)) {
    await ensureAccounts(state);
    const a = await account(e.client);
    link = a?.password ? origin : await invitation(e.client);
  }
  if (["first", "deposit", "questionnaire-reminder"].includes(e.type))
    link = await onboardingLink(e.client);
  const cleanBody = String(e.body || "")
    .replaceAll("in this demo", "")
    .replaceAll(
      "Sign in through your secure invitation to review the terms before paying.",
      "Use your private Service Agreement link. No CRM login is needed yet.",
    )
    .replaceAll(
      "Complete the onboarding questionnaire in your account.",
      "Complete the questionnaire through your private link.",
    )
    .replaceAll(
      "Choose one available walkthrough slot in your account.",
      "Reply with your chosen offered time.",
    )
    .replaceAll("Demo payment receipt:", "Payment recorded:")
    .replaceAll("production account setup link", "account setup link")
    .replaceAll("in the demo Booking screen", "in Walkthrough Booking")
    .replaceAll("Production login and private links are not connected.", "");
  const mail = {
    from: emailProvider === "gmail" ? gmailAddress : process.env.EMAIL_FROM,
    to: [lead.email],
    reply_to: process.env.EMAIL_REPLY_TO || "seekbyritu@gmail.com",
    subject: e.subject,
    text: `Hello ${lead.first},\n\n${cleanBody}\n\n${link ? "Private link: " + link + "\n\n" : ""}${business.name}\n${business.publicAddress || ""}\nCurrency: ${business.currency}\n\nProgramme terms:\n${finalTerms}`,
  };
  if (["slots", "slot-reminder"].includes(e.type))
    mail.text +=
      "\n\nAvailable Walkthrough Times (UTC):\n" +
      (state.workflow[e.client]?.slots || [])
        .map((s) => `${s.date} at ${s.time}`)
        .join("\n");
  const attachments = [];
  const stage = ["balance", "paid"].includes(e.type) ? "balance" : "deposit";
  if (
    ["deposit", "paid"].includes(e.type) &&
    !state.programmes[e.client]?.[stage]
  )
    fail(409, "Verify payment before sending a receipt");
  if (["first", "balance", "deposit", "paid"].includes(e.type)) {
    const kind =
      e.type === "first"
        ? "agreement"
        : ["deposit", "paid"].includes(e.type)
          ? "receipt"
          : "invoice";
    const record = await financialRecord(state, e.client, kind, stage);
    const pdf = await pdfDocument(record);
    attachments.push({
      filename: kind + ".pdf",
      content: pdf.toString("base64"),
    });
  }
  if (e.type === "first")
    attachments.push({
      filename: "deposit-invoice.pdf",
      content: (
        await pdfDocument(
          await financialRecord(state, e.client, "invoice", "deposit"),
        )
      ).toString("base64"),
    });
  if (attachments.length) mail.attachments = attachments;
  await db.query(
    "INSERT INTO deliveries(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
    [id, crypt.seal({ status: "Pending", mail })],
  );
  return { mail };
}
async function sendEmail(id, actor) {
  const prepared = await exclusive(() => prepareEmail(id, actor));
  if (prepared.status === "Already Sent") return prepared;
  let delivery;
  if (emailProvider === "gmail") {
    let connection;
    try {
      connection = await exclusive(async () => {
        const current = await gmailConnection();
        if (!current) throw Error("Reconnect Gmail");
        const updated = await refreshGmail(current, googleClient);
        await storeGmail(updated);
        return updated;
      });
      delivery = await sendGmail(
        { ...prepared.mail, from: gmailAddress, reply_to: gmailAddress },
        id,
        connection.accessToken,
      );
    } catch {
      delivery = {
        status: "Failed",
        message:
          "Gmail authorisation needs attention. Reconnect Gmail in Email Center before retrying.",
      };
    }
  } else {
    let sent = false;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + process.env.RESEND_API_KEY,
          "Content-Type": "application/json",
          "Idempotency-Key": "seek-" + digest(id),
        },
        body: JSON.stringify(prepared.mail),
        signal: AbortSignal.timeout(15000),
      });
      sent = response.ok;
    } catch {}
    delivery = { status: sent ? "Sent" : "Failed" };
  }
  return exclusive(async () => {
    const s = await stateRead(),
      e = s.outbox[id];
    if (!e) fail(404, "Message no longer exists");
    const sent = delivery.status === "Sent";
    e.status = delivery.status;
    e.lastError =
      delivery.status === "Sent"
        ? null
        : delivery.message || "Provider rejected delivery";
    if (sent) {
      e.sentAt = new Date().toISOString();
      if (e.type === "first") {
        s.workflow[e.client] ??= {};
        s.workflow[e.client].firstStepsReviewed = true;
      }
    }
    await db.query(
      "INSERT INTO deliveries(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      [id, crypt.seal({ status: e.status, at: e.sentAt, mail: prepared.mail })],
    );
    await stateWrite(s);
    await audit(actor, sent ? "email_sent" : "email_failed");
    return {
      status: e.status,
      message:
        delivery.message ||
        (sent
          ? "Provider accepted delivery."
          : "Delivery failed. Check sender/provider settings and retry."),
    };
  });
}
async function generateReports() {
  const s = await stateRead();
  for (const l of s.leads) {
    if (l.isTest) continue;
    const p = s.programmes[l.id];
    if (!p?.start || !p.balance || p.status !== "Active") continue;
    const elapsed = Math.floor(
      (Date.parse(day()) - Date.parse(p.start)) / 86400000,
    );
    for (const endDay of [7, 14, 21, 28, 30]) {
      if (elapsed < endDay) continue;
      const id = l.id + ":day" + endDay;
      if ((await db.query("SELECT id FROM reports WHERE id=?", [id]))[0])
        continue;
      await db.query(
        "INSERT INTO reports(id,client_id,payload) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING",
        [
          id,
          l.id,
          crypt.seal({
            client: l.first + " " + l.last,
            data: reportData(s, l.id, endDay),
          }),
        ],
      );
    }
  }
}
const headers = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; connect-src 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (production)
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  const path = new URL(req.url, "http://localhost").pathname;
  try {
    const finalTerms = db ? await approvedProgrammeTerms() : "";
    if (path === "/health")
      return json(res, 200, {
        status: db ? "ok" : "setup_required",
        ready: !!db,
      });
    if (path === "/api/config") {
      const owner = db
        ? (await db.query("SELECT id FROM accounts")).length > 0
        : false;
      return json(res, 200, {
        ready: !!db,
        setupRequired: !owner,
        missing,
        storageError: initError,
        setupDiagnostic,
        emailProvider,
        emailConfigured: db ? await mailConfigured() : false,
        businessConfigured:
          !!business.name &&
          !!business.address &&
          !!business.currency &&
          !!finalTerms,
      });
    }
    if (path.startsWith("/api/")) {
      if (!db)
        fail(
          503,
          "Server configuration is incomplete. Set required Render environment variables.",
        );
      if (req.method !== "GET" && req.headers.origin !== origin)
        fail(403, "Request origin is not allowed");
      if (path === "/api/setup" && req.method === "POST")
        return await exclusive(async () => {
          rateLimit("setup");
          if ((await db.query("SELECT id FROM accounts")).length)
            fail(409, "Owner already created");
          const b = await body(req);
          if (
            (process.env.OWNER_SETUP_TOKEN || "").length < 32 ||
            !constantEqual(b.token, process.env.OWNER_SETUP_TOKEN)
          )
            fail(403, "Invalid owner setup token");
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || ""))
            fail(400, "Valid email required");
          const secret = mfaSecret(),
            recoveryCodes = Array.from({ length: 8 }, () =>
              randomToken().slice(0, 16),
            );
          await saveAccount({
            id: randomUUID(),
            email: b.email.toLowerCase().trim(),
            role: "coach",
            password: await hashPassword(b.password),
            mfa: secret,
            mfaLast: -1,
            recovery: recoveryCodes.map(digest),
          });
          await audit("setup", "owner_created");
          return json(res, 201, {
            secret,
            recoveryCodes,
            message:
              "Save this authenticator secret securely. Sign in with password and current authenticator code. No session is issued without MFA.",
          });
        });
      if (path === "/api/login" && req.method === "POST")
        return await exclusive(async () => {
          const b = await body(req);
          const loginKey = emailHash(String(b.email || ""));
          const wait = loginLimiter.retryAfter(loginKey);
          if (wait) loginBlocked(wait);
          const r = await db.query(
            "SELECT payload FROM accounts WHERE email_hash=?",
            [emailHash(String(b.email || ""))],
          );
          const a = r[0] ? crypt.open(r[0].payload) : null;
          if (
            !a ||
            !a.password ||
            !(await checkPassword(b.password, a.password))
          )
            loginFailure(loginKey);
          if (a.role === "coach") {
            const step = verifyTotp(a.mfa, b.code, a.mfaLast);
            if (step === false) {
              const index = (a.recovery || []).findIndex((v) =>
                constantEqual(v, digest(String(b.code || ""))),
              );
              if (index < 0) {
                if (verifyTotp(a.mfa, b.code, -1) !== false)
                  fail(
                    409,
                    "This authenticator code was already used. Wait for the next code in your app, then sign in.",
                  );
                loginFailure(loginKey);
              }
              a.recovery.splice(index, 1);
            } else a.mfaLast = step;
            await saveAccount(a);
          }
          if (a.role === "client") await requireFullPayment(a.id);
          const csrf = await newSession(res, a);
          await audit(a.id, "login");
          loginLimiter.success(loginKey);
          return json(res, 200, { csrf, role: a.role, id: a.id });
        });
      if (path === "/api/accept-invite" && req.method === "POST")
        return await exclusive(async () => {
          rateLimit("invite");
          const b = await body(req),
            r = await db.query("SELECT * FROM invitations WHERE token_hash=?", [
              digest(String(b.token || "")),
            ]);
          if (!r[0] || r[0].expires < new Date().toISOString())
            fail(400, "This invitation is expired or has been used");
          const a = await account(r[0].user_id);
          await requireFullPayment(a.id);
          a.password = await hashPassword(b.password);
          await saveAccount(a);
          await db.query("DELETE FROM invitations WHERE user_id=?", [a.id]);
          await db.query("DELETE FROM sessions WHERE user_id=?", [a.id]);
          await audit(a.id, "password_set");
          return json(res, 200, {
            message: "Password set. You can now sign in.",
          });
        });
      if (path === "/api/gmail/callback" && req.method === "GET") {
        if (!googleClient.id || !googleClient.secret)
          fail(503, "Google OAuth is not configured");
        const u = new URL(req.url, origin),
          stateHash = digest(u.searchParams.get("state") || "");
        const oauth = await exclusive(async () => {
          const rows = await db.query(
            "SELECT value FROM metadata WHERE name=?",
            ["google_oauth:" + stateHash],
          );
          if (!rows[0])
            fail(400, "Invalid or expired Gmail connection request");
          const entry = crypt.open(rows[0].value);
          await db.query("DELETE FROM metadata WHERE name=?", [
            "google_oauth:" + stateHash,
          ]);
          return entry;
        });
        if (oauth.expires < Date.now())
          fail(400, "Gmail connection request expired");
        if (u.searchParams.get("error") || !u.searchParams.get("code"))
          fail(400, "Gmail connection was not approved");
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: googleClient.id,
            client_secret: googleClient.secret,
            code: u.searchParams.get("code"),
            code_verifier: oauth.verifier,
            redirect_uri: origin + "/api/gmail/callback",
            grant_type: "authorization_code",
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok)
          fail(502, "Google authorisation could not be completed");
        const tokens = await response.json();
        const info = await fetch(
          "https://openidconnect.googleapis.com/v1/userinfo",
          {
            headers: { Authorization: "Bearer " + tokens.access_token },
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!info.ok) fail(502, "Unable to verify connected Google account");
        const profile = await info.json();
        if (profile.email !== gmailAddress || profile.email_verified !== true)
          fail(403, "Connect only seekbyritu@gmail.com");
        if (!tokens.refresh_token)
          fail(400, "Offline consent was not granted. Reconnect with consent.");
        await exclusive(async () => {
          await storeGmail({
            email: profile.email,
            refreshToken: tokens.refresh_token,
            accessToken: tokens.access_token,
            expires: Date.now() + (tokens.expires_in || 3600) * 1000,
          });
          await audit(oauth.owner, "gmail_connected");
        });
        res.writeHead(303, { Location: origin + "/" });
        return res.end();
      }
      if (
        path === "/api/onboarding-access" &&
        ["GET", "POST"].includes(req.method)
      )
        return await exclusive(async () => {
          const token = String(req.headers["x-onboarding-token"] || "");
          if (!/^[A-Za-z0-9_-]{43}$/.test(token))
            fail(
              404,
              "This private link is invalid or expired. Ask Rituparna for a new link.",
            );
          const row = (
            await db.query(
              "SELECT payload FROM documents WHERE section='onboarding_links' AND record_key=?",
              [digest(token)],
            )
          )[0];
          const link = row ? crypt.open(row.payload) : null;
          if (!link || link.expires < new Date().toISOString())
            fail(
              404,
              "This private link has expired. Ask Rituparna for a new link.",
            );
          const s = await stateRead(),
            lead = s.leads.find((l) => l.id === link.client),
            p = s.programmes[link.client] || {};
          if (!lead) fail(404, "Client not found");
          if (p.balance)
            fail(
              409,
              "Onboarding is complete. Use your account activation email to sign in.",
            );
          const version = digest(finalTerms);
          if (req.method === "GET")
            return json(res, 200, {
              name: lead.first,
              terms: finalTerms,
              version,
              approved: !!finalTerms,
              agreement: s.agreements[lead.id] || null,
              deposit: !!p.deposit,
              intake: s.intakes[lead.id] || null,
              questions: globalThis.seekIntakeQuestions,
            });
          const b = await body(req);
          if (b.action === "agree") {
            if (
              !finalTerms ||
              b.version !== version ||
              b.accept !== true ||
              !String(b.name || "").trim()
            )
              fail(
                409,
                "Review the current final Service Agreement before accepting.",
              );
            const at = new Date().toISOString();
            await db.query("INSERT INTO signatures(id,payload) VALUES(?,?)", [
              randomUUID(),
              crypt.seal({
                client: lead.id,
                name: String(b.name).slice(0, 200),
                version,
                text: finalTerms,
                at,
                type: "private_link_acknowledgement",
              }),
            ]);
            s.agreements[lead.id] = {
              name: String(b.name).slice(0, 200),
              version,
              at,
            };
          } else if (b.action === "intake") {
            if (!p.deposit)
              fail(
                403,
                "The questionnaire opens after your deposit is verified.",
              );
            if (s.intakes[lead.id]?.submitted)
              fail(
                409,
                "Your answers have already been submitted and are preserved.",
              );
            if (
              !Array.isArray(b.answers) ||
              b.answers.length !== 30 ||
              b.answers.some(
                (a) => typeof a !== "string" || a.length > 10000,
              ) ||
              (b.submit && b.answers.some((a) => !a.trim()))
            )
              fail(
                400,
                "Complete each questionnaire answer before submitting.",
              );
            s.intakes[lead.id] = {
              answers: b.answers,
              ...(b.submit ? { submitted: new Date().toISOString() } : {}),
            };
          } else fail(400, "Unknown onboarding action");
          await stateWrite(s);
          await audit(lead.id, "private_onboarding_" + b.action);
          return json(res, 200, { ok: true });
        });
      const auth = await session(req);
      if (!auth) fail(401, "Sign in required");
      if (
        req.method !== "GET" &&
        !constantEqual(req.headers["x-csrf-token"] || "", auth.csrf)
      )
        fail(403, "Invalid request token");
      const a = auth.account;
      if (a.role === "client" && path !== "/api/logout")
        await requireFullPayment(a.id);
      if (path === "/api/billing" || path.startsWith("/api/billing/")) {
        if (a.role !== "coach") fail(403, "Coach access required");
        const store = billingStore(db, crypt, finalTerms || innerCodeTerms);
        if (path === "/api/billing" && req.method === "GET")
          return await exclusive(async () =>
            json(res, 200, {
              products: await store.products(),
              documents: await store.documents(),
              payments: await store.payments(),
            }),
          );
        if (path === "/api/billing/pdf" && req.method === "GET") {
          const url = new URL(req.url, "http://localhost");
          const record = [
            ...(await store.documents()),
            ...(await store.payments()),
          ].find((d) => d.id === url.searchParams.get("id"));
          if (!record) fail(404, "Document not found");
          const kind =
            url.searchParams.get("kind") === "agreement"
              ? "agreement"
              : url.searchParams.get("kind") === "receipt"
                ? "receipt"
                : "invoice";
          res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${record.reference || "draft"}-${kind}.pdf"`,
          });
          return res.end(await billingPDF(record, kind));
        }
        if (req.method === "POST")
          return await exclusive(async () => {
            const b = await body(req);
            let result;
            if (path === "/api/billing/product")
              result = await store.saveProduct(b);
            else if (path === "/api/billing/draft")
              result = await store.saveDocument(b, business);
            else if (path === "/api/billing/issue")
              result = await store.issue(b.id, b.version);
            else if (path === "/api/billing/payment")
              result = await store.recordPayment(b);
            else if (path === "/api/billing/revise")
              result = await store.revise(b.id);
            else if (path === "/api/billing/queue") {
              const record = [
                ...(await store.documents()),
                ...(await store.payments()),
              ].find((d) => d.id === b.id);
              if (!record || !["Issued", "Receipt"].includes(record.status))
                fail(409, "Issue the documents before preparing an email");
              const s = await stateRead(),
                lead = s.leads.find(
                  (l) => l.email.toLowerCase() === record.customer.email,
                );
              if (
                lead?.isTest ||
                /\.(invalid|test)$/.test(record.customer.email)
              )
                fail(409, "Live email is disabled for test customers");
              const id = `billing:${record.id}`;
              s.outbox[id] ??= {
                id,
                client: lead?.id || "",
                recipient: record.customer.name,
                documentId: record.id,
                type:
                  record.status === "Receipt" ? "billingreceipt" : "billing",
                manualOnly: true,
                subject: `${record.status === "Receipt" ? "Payment Receipt" : "Your Documents"} — ${record.reference}`,
                body:
                  record.status === "Receipt"
                    ? `To: ${record.customer.email}. Attached: verified payment receipt. Received: ${record.currency} ${(record.receipt.amount / 100).toFixed(2)}. Remaining: ${record.currency} ${((record.total - record.receipt.received) / 100).toFixed(2)}.`
                    : `To: ${record.customer.email}. Attached: invoice${record.requiresAgreement === false ? "" : " and Service Agreement"}. Total: ${record.currency} ${(record.total / 100).toFixed(2)}. Due: ${record.due}. ${record.payment}`,
                due: day(),
                status: "Draft",
              };
              await stateWrite(s);
              result = { queued: true };
            } else fail(404, "Billing action not found");
            await audit(a.id, "billing_" + path.split("/").pop());
            return json(res, 200, { result });
          });
        fail(405, "Method not allowed");
      }
      if (path === "/api/terms" && req.method === "GET")
        return json(res, 200, {
          terms: finalTerms || agreementText(business),
          approved: !!finalTerms,
          business: {
            name: business.name,
            currency: business.currency,
            publicAddress: business.publicAddress,
          },
        });
      if (path === "/api/me")
        return json(res, 200, {
          csrf: auth.csrf,
          role: a.role,
          id: a.id,
          email: a.email,
        });
      if (path.startsWith("/api/gmail/") && a.role !== "coach")
        fail(403, "Coach access required");
      if (path === "/api/gmail/status" && req.method === "GET")
        return json(res, 200, {
          provider: emailProvider,
          oauthConfigured: !!googleClient.id && !!googleClient.secret,
          connected: !!(await gmailConnection())?.refreshToken,
          email: gmailAddress,
        });
      if (path === "/api/gmail/connect" && req.method === "POST")
        return await exclusive(async () => {
          if (!googleClient.id || !googleClient.secret)
            fail(
              503,
              "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Render first",
            );
          const state = randomToken(),
            verifier = randomToken();
          await db.query("INSERT INTO metadata(name,value) VALUES(?,?)", [
            "google_oauth:" + digest(state),
            crypt.seal({
              owner: a.id,
              verifier,
              expires: Date.now() + 10 * 60000,
            }),
          ]);
          const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
          u.search = new URLSearchParams({
            client_id: googleClient.id,
            redirect_uri: origin + "/api/gmail/callback",
            response_type: "code",
            scope: gmailScope,
            access_type: "offline",
            prompt: "consent",
            login_hint: gmailAddress,
            state,
            code_challenge: digestBase64(verifier),
            code_challenge_method: "S256",
          }).toString();
          return json(res, 200, { url: u.toString() });
        });
      if (path === "/api/gmail/disconnect" && req.method === "POST")
        return await exclusive(async () => {
          await db.query("DELETE FROM metadata WHERE name='gmail_connection'");
          await audit(a.id, "gmail_disconnected");
          return json(res, 200, { ok: true });
        });
      if (path === "/api/gmail/resolve-message" && req.method === "POST")
        return await exclusive(async () => {
          const b = await body(req);
          if (!["Sent", "Draft"].includes(b.status))
            fail(400, "Invalid resolution");
          const rows = await db.query(
            "SELECT payload FROM deliveries WHERE id=?",
            [b.id],
          );
          if (!rows[0]) fail(404, "Delivery not found");
          const d = crypt.open(rows[0].payload);
          if (d.status !== "Unknown")
            fail(409, "Only uncertain deliveries need manual resolution");
          d.status = b.status;
          d.resolvedBy = a.id;
          d.resolvedAt = new Date().toISOString();
          await db.query("UPDATE deliveries SET payload=? WHERE id=?", [
            crypt.seal(d),
            b.id,
          ]);
          const s = await stateRead();
          if (s.outbox[b.id]) s.outbox[b.id].status = b.status;
          await stateWrite(s);
          await audit(a.id, "gmail_delivery_resolved");
          return json(res, 200, { ok: true });
        });
      if (path === "/api/logout" && req.method === "POST") {
        await db.query("DELETE FROM sessions WHERE token_hash=?", [
          auth.token_hash,
        ]);
        res.setHeader(
          "Set-Cookie",
          "seek_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        );
        return json(res, 200, { ok: true });
      }
      if (path === "/api/state" && req.method === "GET")
        return await exclusive(async () =>
          json(res, 200, {
            state: scope(await stateRead(), a),
            revision: await revision(),
          }),
        );
      if (path === "/api/state" && req.method === "PUT")
        return await exclusive(async () => {
          const b = await body(req);
          const old = await stateRead(),
            incoming = clean(b.state || {});
          let next;
          if (b.base) {
            const base = clean(b.base);
            const patched = changedPatch(
              a.role === "coach" ? old : scope(old, a),
              incoming,
              base,
              a.role === "coach",
            );
            next =
              a.role === "coach" ? patched : await mergeClient(old, patched, a);
          } else {
            if (b.revision !== (await revision()))
              fail(
                409,
                "Data changed on another device. Reload before editing further.",
              );
            next =
              a.role === "coach"
                ? Object.fromEntries(
                    sections.map((k) => [
                      k,
                      incoming[k] || (k === "leads" ? [] : {}),
                    ]),
                  )
                : await mergeClient(old, incoming, a);
          }
          if (
            !Array.isArray(next.leads) ||
            next.leads.some((l) => !l.id || !l.email || !l.first || !l.last)
          )
            fail(400, "Lead details are invalid");
          if (a.role === "coach")
            for (const l of next.leads) {
              if (["daniel", "meera"].includes(l.id))
                fail(400, "Legacy sample profiles cannot be imported");
            }
          if (a.role === "coach")
            for (const [id, p] of Object.entries(next.programmes)) {
              p.verifiedAt = { ...(old.programmes[id]?.verifiedAt || {}) };
              for (const stage of ["deposit", "balance"])
                if (p[stage] && !old.programmes[id]?.[stage])
                  p.verifiedAt[stage] = new Date().toISOString();
            }
          await ensureAccounts(next);
          const nextRevision = await stateWrite(next);
          await audit(a.id, "state_saved");
          return json(res, 200, {
            revision: nextRevision,
            state: scope(next, a),
          });
        });
      if (
        a.role !== "coach" &&
        ["/api/invite", "/api/send-email", "/api/export"].includes(path)
      )
        fail(403, "Coach access required");
      if (path === "/api/test-client" && req.method === "POST")
        return await exclusive(async () => {
          if (a.role !== "coach") fail(403, "Coach access required");
          const s = await stateRead(),
            lead = addTestClient(s);
          await ensureAccounts(s);
          await stateWrite(s);
          await audit(a.id, "test_client_created");
          return json(res, 200, {
            id: lead.id,
            message:
              "Test client ready. No real emails or payments are triggered.",
          });
        });
      if (path === "/api/onboarding-link" && req.method === "POST")
        return await exclusive(async () => {
          if (a.role !== "coach") fail(403, "Coach access required");
          const b = await body(req),
            s = await stateRead();
          if (!s.leads.some((l) => l.id === b.id))
            fail(404, "Client not found");
          return json(res, 200, { link: await onboardingLink(b.id) });
        });
      if (path === "/api/invite" && req.method === "POST")
        return await exclusive(async () => {
          const b = await body(req),
            s = await stateRead();
          if (!s.leads.some((l) => l.id === b.id)) fail(404, "Lead not found");
          await ensureAccounts(s);
          const link = await invitation(b.id);
          await audit(a.id, "invitation_created");
          return json(res, 200, { link, expiresInHours: 48 });
        });
      if (path === "/api/send-email" && req.method === "POST") {
        const b = await body(req);
        return json(res, 200, await sendEmail(b.id, a.id));
      }
      if (path === "/api/export" && req.method === "GET") {
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="seek-encrypted-backup.json"',
        );
        await audit(a.id, "encrypted_backup_export");
        return json(res, 200, {
          format: "seek-encrypted-v1",
          documents: await db.query("SELECT * FROM documents"),
          accounts: await db.query("SELECT * FROM accounts"),
          signatures: await db.query("SELECT * FROM signatures"),
          deliveries: await db.query("SELECT * FROM deliveries"),
          journal_entries: await db.query("SELECT * FROM journal_entries"),
          reports: await db.query("SELECT * FROM reports"),
          financial_documents: await db.query(
            "SELECT * FROM financial_documents",
          ),
          audit: await db.query("SELECT * FROM audit"),
          metadata: await db.query("SELECT * FROM metadata"),
        });
      }
      if (path.startsWith("/api/template/") && req.method === "GET") {
        if (a.role !== "coach") fail(403, "Coach access required");
        const name = decodeURIComponent(path.slice("/api/template/".length));
        const allowed = [
          "01-Coaching-Agreement-DRAFT.pdf",
          "02-Deposit-Payment-Request-DRAFT.pdf",
          "03-Balance-Invoice-DRAFT.pdf",
          "04-Payment-Receipt-DRAFT.pdf",
          "Inner-Code-Agreement-and-Payment-Pack-DRAFT.pdf",
        ];
        if (!allowed.includes(name)) fail(404, "Template not found");
        const pdf = await readFile(
          new URL("./docs/templates/" + name, import.meta.url),
        );
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
        });
        return res.end(pdf);
      }
      if (path.startsWith("/api/pdf/") && req.method === "GET") {
        const u = new URL(req.url, "http://localhost"),
          id = u.searchParams.get("client"),
          kind = path.split("/").pop(),
          stage =
            u.searchParams.get("stage") === "balance" ? "balance" : "deposit";
        if (a.role !== "coach" && a.id !== id) fail(403, "Access denied");
        const s = await stateRead(),
          l = s.leads.find((l) => l.id === id);
        if (!l) fail(404, "Client not found");
        if (!["agreement", "invoice", "receipt"].includes(kind))
          fail(404, "Document not found");
        if (kind === "receipt" && !s.programmes[id]?.[stage])
          fail(409, "Payment has not been confirmed");
        let record = await financialRecord(s, id, kind, stage);
        if (kind === "agreement" && s.agreements[id]?.version) {
          const signatures = (
            await db.query("SELECT payload FROM signatures")
          ).map((r) => crypt.open(r.payload));
          const signature = signatures.find(
            (sig) =>
              (sig.client === id || sig.account === id) &&
              sig.version === s.agreements[id].version,
          );
          if (signature)
            record = {
              ...record,
              body: signature.text,
              acknowledgement: { name: signature.name, at: signature.at },
              reference:
                "SEEK-ACK-" + signature.version.slice(0, 12).toUpperCase(),
            };
        }
        const reference = record.reference;
        const pdf = await pdfDocument(record);
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${reference}.pdf"`,
        });
        return res.end(pdf);
      }
      if (path === "/api/journal-history" && req.method === "GET") {
        const u = new URL(req.url, "http://localhost"),
          id = u.searchParams.get("client"),
          cursor = (u.searchParams.get("before") || "9999-99-99|").split("|"),
          before = cursor[0],
          kindAfter = cursor[1] || "";
        if (a.role !== "coach" && a.id !== id) fail(403, "Access denied");
        const rows = await db.query(
          "SELECT entry_date,kind,payload FROM journal_entries WHERE client_id=? AND (entry_date<? OR (entry_date=? AND kind>?)) ORDER BY entry_date DESC,kind LIMIT 20",
          [id, before, before, kindAfter],
        );
        return json(res, 200, {
          entries: rows.map((r) => ({
            date: r.entry_date,
            kind: r.kind,
            ...crypt.open(r.payload),
          })),
          next:
            rows.length === 20
              ? rows.at(-1).entry_date + "|" + rows.at(-1).kind
              : null,
        });
      }
      if (path === "/api/reports" && req.method === "GET")
        return await exclusive(async () => {
          await generateReports();
          const rows = await db.query(
            "SELECT id,client_id,payload FROM reports",
          );
          return json(res, 200, {
            reports: rows
              .filter((r) => a.role === "coach" || r.client_id === a.id)
              .map((r) => ({
                id: r.id,
                client: r.client_id,
                ...crypt.open(r.payload).data,
              })),
          });
        });
      if (path.startsWith("/api/report/") && req.method === "GET") {
        const id = decodeURIComponent(path.slice("/api/report/".length)),
          rows = await db.query("SELECT * FROM reports WHERE id=?", [id]);
        if (!rows[0]) fail(404, "Report not found");
        if (a.role !== "coach" && rows[0].client_id !== a.id)
          fail(403, "Access denied");
        const report = crypt.open(rows[0].payload),
          pdf = await reportPDF(report.client, report.data);
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="seek-progress.pdf"',
        });
        return res.end(pdf);
      }
      if (path === "/api/agreement" && req.method === "POST")
        return await exclusive(async () => {
          if (finalTerms.length > 20000)
            fail(409, "Programme terms exceed the supported limit");
          if (
            !finalTerms ||
            !business.name ||
            !business.address ||
            !business.currency
          )
            fail(409, "Final approved terms and business details are required");
          const b = await body(req);
          if (a.role !== "client" || !b.name?.trim() || b.accept !== true)
            fail(400, "Client acknowledgement is required");
          const text = finalTerms,
            version = digest(text + JSON.stringify(business));
          await db.query("INSERT INTO signatures(id,payload) VALUES(?,?)", [
            randomUUID(),
            crypt.seal({
              account: a.id,
              name: b.name,
              version,
              text,
              business,
              at: new Date().toISOString(),
              type: "authenticated_acknowledgement",
            }),
          ]);
          const state = await stateRead();
          state.agreements[a.id] = {
            name: b.name,
            version,
            at: new Date().toISOString(),
          };
          await stateWrite(state);
          await audit(a.id, "agreement_acknowledged");
          return json(res, 201, {
            version,
            message:
              "Authenticated acknowledgement saved. This is not third-party identity-verified signing.",
          });
        });
      fail(404, "Endpoint not found");
    }
    const files = {
      "/": "index.html",
      "/index.html": "index.html",
      "/style.css": "style.css",
      "/app.js": "app.js",
      "/billing.js": "billing.js",
      "/workspace.js": "workspace.js",
      "/intake.js": "intake.js",
      "/assets/fonts/OpenSans-Semibold.ttf":
        "assets/fonts/OpenSans-Semibold.ttf",
      "/auth.js": "auth.js",
      "/calendar.js": "calendar.js",
      "/assets/seekbyritu-logo.png": "assets/seekbyritu-logo.png",
      "/assets/fonts/NotoSerif-Regular.ttf":
        "assets/fonts/NotoSerif-Regular.ttf",
      "/assets/fonts/OpenSans-Regular.ttf": "assets/fonts/OpenSans-Regular.ttf",
    };
    if (!files[path]) fail(404, "Not found");
    const f = files[path],
      data = await readFile(new URL("./public/" + f, import.meta.url));
    res.writeHead(200, {
      "Content-Type": f.endsWith(".png")
        ? "image/png"
        : f.endsWith(".ttf")
          ? "font/ttf"
          : f.endsWith(".js")
            ? "text/javascript"
            : f.endsWith(".css")
              ? "text/css"
              : "text/html; charset=utf-8",
    });
    res.end(data);
  } catch (error) {
    if (!res.headersSent) res.removeHeader("Set-Cookie");
    if (!production && !error.status) console.error(error.stack);
    if (error.retryAfter)
      res.setHeader("Retry-After", String(error.retryAfter));
    json(res, error.status || 500, {
      ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
      error: error.status
        ? error.message
        : "Unable to complete request. Please try again or contact the coach.",
    });
  }
});
// A restart after a provider request cannot prove delivery failed. Require review.
if (db)
  await exclusive(async () => {
    const s = await stateRead();
    let changed = false;
    for (const e of Object.values(s.outbox)) {
      if (!["billing", "billingreceipt"].includes(e.type)) continue;
      const row = (
        await db.query("SELECT payload FROM deliveries WHERE id=?", [e.id])
      )[0];
      if (!row) continue;
      const delivery = crypt.open(row.payload);
      if (delivery.status !== "Pending") continue;
      delivery.status = "Unknown";
      await db.query("UPDATE deliveries SET payload=? WHERE id=?", [
        crypt.seal(delivery),
        e.id,
      ]);
      e.status = "Unknown";
      e.lastError =
        "Delivery was interrupted. Check Gmail Sent before resolving or retrying.";
      changed = true;
    }
    if (changed) await stateWrite(s);
  });
server.listen(process.env.PORT || 3000, "0.0.0.0");
if (db) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const ids = await exclusive(async () => {
        await generateReports();
        await db.query("DELETE FROM sessions WHERE expires<?", [
          new Date().toISOString(),
        ]);
        await db.query("DELETE FROM invitations WHERE expires<?", [
          new Date().toISOString(),
        ]);
        if (process.env.MAIL_AUTOMATION !== "true") return [];
        const s = await stateRead();
        return Object.values(s.outbox)
          .filter(
            (e) => !e.manualOnly && e.status === "Draft" && e.due <= day(),
          )
          .map((e) => e.id);
      });
      for (const id of ids)
        try {
          await sendEmail(id, "scheduler");
        } catch {}
    } catch {
      console.error(
        "Background job failed; the next scheduled run will retry.",
      );
    } finally {
      running = false;
    }
  }, 60000);
  timer.unref();
}
