import { randomUUID } from "node:crypto";
const fail = (message) => {
  throw Object.assign(Error(message), { status: 400 });
};
const text = (value, max) =>
  String(value || "")
    .trim()
    .slice(0, max);
export function communicationStore(db, crypt) {
  const list = async (section) =>
    (
      await db.query("SELECT payload FROM documents WHERE section=?", [section])
    ).map((r) => crypt.open(r.payload));
  const put = async (section, r) =>
    db.query(
      "INSERT INTO documents(section,record_key,payload) VALUES(?,?,?) ON CONFLICT(section,record_key) DO UPDATE SET payload=excluded.payload",
      [section, r.id, crypt.seal(r)],
    );
  return {
    async annotation(id) {
      return (await list("communication_annotations")).find((n) => n.id === id);
    },
    async tasks() {
      return (await list("client_communications")).filter(
        (n) => n.nextAction && !n.completedAt,
      );
    },
    async complete(s, id, actor) {
      const n = (await list("client_communications")).find((n) => n.id === id);
      if (!n || !s.leads.some((l) => l.id === n.client))
        fail("Follow-up not found.");
      if (!n.completedAt) {
        n.completedAt = new Date().toISOString();
        await put("client_communications", n);
        await put("client_communications", {
          id: randomUUID(),
          client: n.client,
          channel: "Internal Note",
          note: "Follow-up completed: " + n.nextAction,
          actor,
          createdAt: n.completedAt,
        });
      }
      return { completed: true };
    },
    async annotate(s, b, actor) {
      if (!s.leads.some((l) => l.id === b.client))
        fail("Choose an existing client.");
      const channel = text(b.channel, 30) || "Internal Note";
      if (
        !["Internal Note", "WhatsApp", "Phone", "Meeting", "Email"].includes(
          channel,
        )
      )
        fail("Choose a valid communication channel.");
      const body = text(b.note, 5000);
      if (!body) fail("Enter a note or summary.");
      if (b.emailId && s.outbox[b.emailId]?.client !== b.client)
        fail("Choose an email for this client.");
      const status = text(b.disposition, 30) || "Active";
      if (!["Active", "Superseded", "Discarded"].includes(status))
        fail("Choose a valid communication status.");
      if (
        b.emailId &&
        status === "Discarded" &&
        s.outbox[b.emailId].status !== "Draft"
      )
        fail(
          "Only an unsent draft can be discarded. Use Superseded for an email already sent.",
        );
      if (
        b.emailId &&
        ["Pending", "Unknown"].includes(s.outbox[b.emailId].status)
      )
        fail(
          "Resolve uncertain email delivery before changing its communication status.",
        );
      const r = {
        id: randomUUID(),
        client: b.client,
        channel,
        note: body,
        emailId: text(b.emailId, 200),
        disposition: status,
        replacement: text(b.replacement, 200),
        nextAction: text(b.nextAction, 500),
        due: b.due || "",
        actor,
        createdAt: new Date().toISOString(),
      };
      if (r.due && !/^\d{4}-\d{2}-\d{2}$/.test(r.due))
        fail("Choose a valid follow-up date.");
      await put("client_communications", r);
      if (r.emailId)
        await put("communication_annotations", {
          ...r,
          id: r.emailId,
          eventId: r.id,
        });
      return r;
    },
    async get(s, id) {
      const lead = s.leads.find((l) => l.id === id);
      if (!lead) fail("Client not found.");
      const annotations = (await list("communication_annotations")).filter(
        (r) => r.client === id,
      );
      const notes = (await list("client_communications")).filter(
        (r) => r.client === id,
      );
      const archived = (await list("communication_email_archive")).filter(
        (e) => e.client === id,
      );
      const emails = [
        ...Object.values(s.outbox).filter((e) => e.client === id),
        ...archived.filter((e) => !s.outbox[e.id]),
      ].map((e) => ({
        ...e,
        annotation: annotations.find((n) => n.id === e.id),
      }));
      const documents = (await list("billing_documents")).filter(
        (d) =>
          d.clientId === id ||
          d.customer?.email?.toLowerCase() === lead.email.toLowerCase(),
      );
      const payments = (await list("billing_payments")).filter(
        (d) =>
          d.clientId === id ||
          d.customer?.email?.toLowerCase() === lead.email.toLowerCase(),
      );
      const reviews = (await list("billing_sync_reviews")).filter(
        (d) => d.client === id,
      );
      const legacy = (await db.query("SELECT payload FROM financial_documents"))
        .map((r) => crypt.open(r.payload))
        .filter(
          (d) => d.customerEmail?.toLowerCase() === lead.email.toLowerCase(),
        );
      for (const oldReceipt of legacy.filter((d) => d.kind === "receipt")) {
        const overlapping = payments.filter(
          (d) =>
            d.receipt.amount === Math.round(oldReceipt.amount * 100) &&
            d.reference !== oldReceipt.reference &&
            !d.clientId,
        );
        if (
          overlapping.length &&
          !reviews.some((r) => r.stage === oldReceipt.stage)
        )
          reviews.push({
            id: "comparison:" + oldReceipt.reference,
            client: id,
            stage: oldReceipt.stage,
            status: "Needs Review",
            reason:
              "Potential overlapping historical receipts. Review the payment dates and transaction references before choosing the official record. No record was changed.",
            documents: [
              {
                reference: oldReceipt.reference,
                total: Math.round(oldReceipt.amount * 100),
              },
              ...overlapping,
            ],
          });
      }
      const deleted = (await list("billing_document_events")).filter(
        (d) =>
          d.clientId === id ||
          d.customerEmail?.toLowerCase() === lead.email.toLowerCase(),
      );
      const w = s.workflow[id] || {},
        p = s.programmes[id] || {};
      const milestones = [
        ["Questionnaire Submitted", s.intakes[id]?.submitted],
        ["Plan Ready", typeof w.planReady === "string" ? w.planReady : null],
        [
          "Plan Review Completed",
          typeof w.walkthroughDone === "string" ? w.walkthroughDone : null,
        ],
        ["Service Agreement Acknowledged", s.agreements[id]?.at],
        [
          "Program Start Scheduled",
          p.status !== "Not Activated" ? p.start : null,
        ],
      ]
        .filter(([, at]) => at)
        .map(([label, createdAt]) => ({
          id: "milestone:" + label,
          label,
          createdAt,
        }));
      const events = [
        ...milestones,
        ...deleted.map((d) => ({
          ...d,
          label:
            d.event + ": " + d.reference + (d.reason ? " — " + d.reason : ""),
        })),
        ...notes.map((n) => ({ ...n, label: n.channel + ": " + n.note })),
        ...emails.map((e) => ({
          id: "email:" + e.id,
          createdAt: e.sentAt || e.created || "",
          label: `Email ${e.status}: ${e.subject}${e.documentReferences?.length ? " · " + e.documentReferences.map((d) => d.kind + ": " + d.reference).join(" · ") : ""}`,
          reference: e.documentId || "",
          annotation: e.annotation,
        })),
        ...documents
          .filter((d) => !deleted.some((e) => e.documentId === d.id))
          .map((d) => ({
            id: "doc:" + d.id,
            createdAt: d.issuedAt || d.updatedAt,
            label: `Invoice ${d.status}: ${d.reference || "Draft"}`,
            reference: d.reference,
          })),
        ...payments
          .filter((d) => !deleted.some((e) => e.documentId === d.id))
          .map((d) => ({
            id: "payment:" + d.id,
            createdAt: d.updatedAt || d.receipt?.date,
            label: `Payment Verified / Receipt Issued: ${d.reference}`,
            reference: d.reference,
          })),
      ].sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
      );
      return {
        emails,
        notes,
        events,
        reviews,
        documents: documents.map((d) => ({
          id: d.id,
          reference: d.reference,
          total: d.total,
          currency: d.currency,
          status: d.status,
          clientId: d.clientId,
          stage: d.paymentStage,
        })),
        payments: payments.map((d) => ({
          id: d.id,
          reference: d.reference,
          invoiceReference: d.invoiceReference,
          total: d.total,
          receipt: d.receipt,
        })),
        legacyDocuments: legacy.map((d) => ({
          reference: d.reference,
          kind: d.kind,
          stage: d.stage,
          amount: d.amount,
          date: d.date,
        })),
        selfReporting:
          "Habit completion and check-ins are self-reported. No evidence uploads or links are required.",
      };
    },
  };
}

export async function recordDocumentEvent(db, crypt, section, record) {
  if (!["billing_documents", "billing_payments"].includes(section)) return;
  const event =
    section === "billing_payments"
      ? record.source === "Client"
        ? "Receipt Linked To Billing"
        : "Payment Verified / Receipt Issued"
      : record.source === "Client"
        ? "Invoice Linked To Billing"
        : record.status === "Draft"
          ? "Draft Saved"
          : "Invoice Issued";
  const value = {
    id: `${section}:${record.id}:${record.version}:${record.status}:${record.updatedAt}`,
    documentId: record.id,
    clientId: record.clientId || "",
    customerEmail: record.customer?.email || "",
    reference: record.reference || "Draft",
    event,
    createdAt: record.updatedAt || new Date().toISOString(),
  };
  await db.query(
    "INSERT INTO documents(section,record_key,payload) VALUES('billing_document_events',?,?) ON CONFLICT(section,record_key) DO NOTHING",
    [value.id, crypt.seal(value)],
  );
}
