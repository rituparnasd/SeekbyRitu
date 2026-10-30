const pillars = ["Health", "Relationships", "Career", "Money", "Spirituality"];
const pillarPaths = [
  "M12 20s-8-4.6-8-11a4 4 0 0 1 8-2 4 4 0 0 1 8 2c0 6.4-8 11-8 11Z",
  "M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm9 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20v-2a6 6 0 0 1 12 0v2m1-7a5 5 0 0 1 7 5v2",
  "M8 6V3h8v3M3 7h18v14H3V7Zm0 6h18",
  "M4 7c0-4 16-4 16 0s-16 4-16 0Zm0 0v10c0 4 16 4 16 0V7M4 12c0 4 16 4 16 0",
  "m12 2 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1 3-7Z",
];
function pillarIcon(p) {
  return `<svg class="pillar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${pillarPaths[pillars.indexOf(p)] || pillarPaths[4]}"/></svg>`;
}
function groupedHabits(mode) {
  const all = habits();
  const groups = pillars.map((p) => [
    p,
    all.map((h, i) => ({ h, i })).filter(({ h }) => h[0] === p),
  ]);
  const other = all
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => !pillars.includes(h[0]));
  if (other.length) groups.push(["Other Agreed Actions", other]);
  return `<div class="habit-pillars">${
    groups
      .filter(([, rows]) => rows.length)
      .map(
        ([p, rows]) =>
          `<details class="habit-pillar" ${mode === "track" && matchMedia("(min-width: 701px)").matches ? "open" : ""}><summary>${pillarIcon(p)}<span>${p}</span><span class="small muted">${rows.filter(({ i }) => status(i) === "done").length}/${rows.length}</span></summary><div class="pillar-actions">${rows.map(({ h, i }) => (mode === "track" ? `<label class="daily-action"><input type="checkbox" data-habit="${i}" aria-label="${esc(h[1])}" ${status(i) === "done" ? "checked" : ""}><span class="${status(i) === "done" ? "completed" : ""}">${esc(h[1])}</span></label><select class="habit-status" aria-label="Status for ${esc(h[1])}" data-status="${i}">${["pending", "done", "adapted", "rest", "missed"].map((v) => `<option value="${v}" ${status(i) === v ? "selected" : ""}>${{ pending: "Not Yet", done: "Done", adapted: "Adapted", rest: "Agreed Rest", missed: "Missed" }[v]}</option>`).join("")}</select>` : mode === "plan" ? `<div class="list-item"><strong>${esc(h[1])}</strong>${h[2] ? `<p class="small muted">${esc(h[2])}</p>` : ""}${h[3] ? `<p class="small">Agreed Target: ${esc(h[3])}</p>` : ""}${h[4] ? `<p class="small">Your Work Block: ${esc(h[4])}</p>` : ""}${h[5] ? `<p class="small muted">Agreed Alternative: ${esc(h[5])}</p>` : ""}</div>` : `<div class="list-item row"><span>${esc(h[1])}</span><span class="badge">${esc(status(i))}</span></div>`)).join("")}</div></details>`,
      )
      .join("") ||
    '<p class="muted">Your plan will appear here when it is ready.</p>'
  }</div>`;
}
function clientStage(id) {
  const p = programme(id),
    w = workflow(id),
    first = state.outbox[id + ":first"];
  if (p.status === "On Hold") return { label: "On Hold", view: "calendar" };
  if (p.status === "Ended")
    return { label: "Programme Ended", view: "reports" };
  if (p.balance && p.status !== "Active")
    return {
      label:
        w.activationIssue || "Payment Complete · Check Programme Activation",
      view: "calendar",
    };
  if (p.balance)
    return {
      label: p.start > day ? "Starting Soon" : "Programme Active",
      view: "reports",
    };
  if (!first?.sentAt && !clients.find((x) => x.id === id)?.isTest)
    return { label: "Send First Steps", email: id + ":first" };
  if (!p.deposit)
    return { label: "Waiting For CAD 150 Deposit", payment: "deposit" };
  if (!state.intakes[id]?.submitted)
    return { label: "Waiting For Questionnaire", email: id + ":deposit" };
  if (!w.planReady)
    return { label: "Prepare Personalised Plan", view: "habits" };
  if (!w.booking) return { label: "Arrange Plan Walkthrough", booking: true };
  if (!w.walkthroughDone)
    return { label: "Complete Plan Walkthrough", walkthrough: true };
  if (!p.agreed) return { label: "Record Plan Approval", payment: "agreed" };
  return { label: "Waiting For CAD 350 Balance", payment: "balance" };
}
const clientViews = [
  "clienthub",
  "profile",
  "habits",
  "practices",
  "onboarding",
  "resources",
  "reports",
  "records",
  "journals",
  "notes",
];
function clientNavigation() {
  if (!clientViews.includes(state.view) || !c().id) return "";
  return `<div class="client-context"><button class="btn subtle" data-view="clients">← Clients</button><strong>${esc(c().name)}</strong><div class="tabs">${[
    ["clienthub", "Overview"],
    ["habits", "Plan & Habits"],
    ["practices", "Daily Practices"],
    ["resources", "Resources"],
    ["reports", "Progress"],
    ["journals", "Journals"],
    ["notes", "Coach Notes"],
  ]
    .map(
      ([v, l]) =>
        `<button class="btn subtle ${state.view === v ? "primary" : ""}" data-view="${v}">${l}</button>`,
    )
    .join("")}</div></div>`;
}
function clientHub() {
  const x = c(),
    p = programme(x.id),
    w = workflow(x.id),
    next = clientStage(x.id);
  const main = next.email
    ? `<button class="btn primary" data-client-email="${next.email}">Review Email</button>`
    : next.payment
      ? `<button class="btn primary" data-payment="${x.id}" data-kind="${next.payment}">${next.payment === "agreed" ? "Record Client Approval" : "Record Verified Payment"}</button>`
      : next.booking
        ? '<a class="btn primary" href="#booking-controls">Offer Walkthrough Slots</a>'
        : next.walkthrough
          ? '<button class="btn primary" data-walkthrough-done>Record Walkthrough Completed</button>'
          : `<button class="btn primary" data-view="${next.view || "habits"}">${next.view === "reports" ? "View Progress" : next.view === "calendar" ? "Check Schedule" : "Open Plan"}</button>`;
  const doneSteps = [
    !!p.deposit,
    !!state.intakes[x.id]?.submitted,
    !!w.planReady,
    !!w.walkthroughDone,
    !!p.balance,
  ];
  return (
    title(
      x.name,
      "Everything for this client, together.",
      `<button class="btn" data-preview="${x.id}">Preview Client View</button>`,
    ) +
    `<div class="hero"><div class="eyebrow">Next Step</div><h2>${next.label}</h2>${main}</div><ol class="journey-steps">${["Deposit", "Questionnaire", "Plan", "Walkthrough", "Balance"].map((l, i) => `<li class="${doneSteps[i] ? "step-done" : ""}">${doneSteps[i] ? "✓ " : ""}${l}</li>`).join("")}</ol><div id="client-email-panel"></div><div id="payment-panel"></div><div class="grid"><section><div class="card"><h2>Client Details</h2><p>${esc(state.leads.find((l) => l.id === x.id)?.email || "")}</p><div class="actions"><button class="btn" data-view="profile">Profile & Original Answers</button><button class="btn" data-view="onboarding">Questionnaire</button><button class="btn" id="copy-onboarding-link">Copy Private Onboarding Link</button></div></div><div class="card"><h2>Payments & Documents</h2><p class="small muted">One Service Agreement defines the service. Invoices request payment. Receipts confirm verified payments.</p><div class="actions"><button class="btn primary" data-client-billing="${x.id}">Open Billing For This Client</button></div><details><summary>Inner Code Payment History</summary><p>Deposit: ${p.deposit ? "CAD 150 verified" : "Not received"} · Balance: ${p.balance ? "CAD 350 verified" : "Not received"}</p><div class="actions">${p.deposit ? `<a class="btn subtle" href="/api/pdf/receipt?client=${x.id}&stage=deposit">Deposit Receipt</a>` : ""}${p.balance ? `<a class="btn subtle" href="/api/pdf/receipt?client=${x.id}&stage=balance">Balance Receipt</a>` : ""}</div></details></div></section><aside><details class="card" id="booking-controls" ${next.booking || next.walkthrough ? "open" : ""}><summary>Plan Deadline & Walkthrough</summary>${workflowControls()}${w.slots?.length && !w.booking ? `<form id="coach-booking-form"><label for="coach-slot">Client’s Chosen Slot</label><select id="coach-slot" name="slot">${w.slots.map((s, i) => `<option value="${i}">${s.date} · ${s.time} UTC</option>`).join("")}</select><button class="btn">Confirm Booking</button></form>` : ""}</details><details class="card"><summary>All Emails For This Client</summary>${
      Object.values(state.outbox)
        .filter((e) => e.client === x.id)
        .map(
          (e) =>
            `<div class="list-item row"><span>${esc(e.subject)} · ${esc(e.status)}</span><button class="btn subtle" data-client-email="${e.id}">Review</button></div>`,
        )
        .join("") || "<p>No messages prepared yet.</p>"
    }</details></aside></div>`
  );
}
function adminPage() {
  return (
    title("Admin", "Occasional settings. Your daily work stays on Today.") +
    `<div class="card"><div class="list-item row"><div><h2>Email Connection & History</h2><p class="muted">Connect Gmail, review delivery and resolve sending issues.</p></div><button class="btn" data-view="emails">Open Email Center</button></div><div class="list-item row"><div><h2>Sample Client Preview</h2><p class="muted">An isolated fictional profile for checking the client experience.</p></div><button class="btn" id="create-test-client">Preview Sample Client</button></div><div class="list-item row"><div><h2>Data Backup</h2><p class="muted">Download an encrypted copy for secure storage.</p></div><a class="btn" href="/api/export">Download Backup</a></div><p class="small muted">Your CRM calendar schedules coaching calls internally. Google Calendar sync is not connected. Calendar times are currently UTC.</p></div>`
  );
}
function bindSimpleWorkspace() {
  $("#copy-onboarding-link")?.addEventListener("click", async () => {
    try {
      await saveChain;
      const r = await api("/api/onboarding-link", {
        method: "POST",
        headers: { "X-CSRF-Token": window.__session.csrf },
        body: JSON.stringify({ id: c().id }),
      });
      await navigator.clipboard.writeText(r.link);
      toast("Private onboarding link copied. Expires in seven days.");
    } catch (err) {
      toast(err.message);
    }
  });

  document.querySelectorAll("[data-client-billing]").forEach(
    (b) =>
      (b.onclick = () => {
        billingCustomerFilter =
          state.leads.find((l) => l.id === b.dataset.clientBilling)?.email ||
          "";
        documentEditor = null;
        navigate("billing");
      }),
  );
  document.querySelectorAll("[data-client-email]").forEach(
    (b) =>
      (b.onclick = () => {
        const e = state.outbox[b.dataset.clientEmail];
        if (!e) return;
        $("#client-email-panel").innerHTML =
          `<section class="card"><h2>${esc(e.subject)}</h2><p class="email-body">${esc(e.body)}</p><p class="small muted">Status: ${esc(e.status)}. Attachments and private links are added from the verified record.</p><button class="btn primary" id="send-client-email" ${["Sent", "Unknown", "Paused", "Cancelled"].includes(e.status) ? "disabled" : ""}>Send Email</button></section>`;
        $("#client-email-panel").scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        $("#send-client-email").onclick = async (ev) => {
          ev.target.disabled = true;
          try {
            await saveChain;
            const r = await api("/api/send-email", {
              method: "POST",
              headers: { "X-CSRF-Token": window.__session.csrf },
              body: JSON.stringify({ id: e.id }),
            });
            toast(r.message);
            await refreshWorkspaceState();
            render();
          } catch (err) {
            toast(err.message);
            ev.target.disabled = false;
          }
        };
      }),
  );
  document.querySelectorAll("[data-payment]").forEach(
    (b) =>
      (b.onclick = () => {
        const kind = b.dataset.kind,
          id = b.dataset.payment,
          p = programme(id);
        if (p[kind]) return toast("Already recorded.");
        const root = $("#payment-panel");
        if (!root) return;
        root.innerHTML = `<form id="verify-payment-form" class="card"><h2>${kind === "agreed" ? "Record Plan Approval" : "Record Verified " + (kind === "deposit" ? "CAD 150 Deposit" : "CAD 350 Balance")}</h2><p>Record this only after ${kind === "agreed" ? "the client has approved the discussed plan." : "you have checked that the payment reached your account."}</p>${kind !== "agreed" ? '<label>Payment Date</label><input name="date" type="date" required value="' + day + '"><label>Payment Method</label><input name="method" required maxlength="100"><label>Transaction Reference</label><input name="reference" required maxlength="200">' : ""}<label><input type="checkbox" required> I have verified this.</label><button class="btn primary">Confirm Record</button></form>`;
        root.scrollIntoView({ behavior: "smooth", block: "start" });
        $("#verify-payment-form").onsubmit = async (ev) => {
          ev.preventDefault();
          const f = new FormData(ev.target);
          p[kind] = true;
          p.paymentDetails ??= {};
          p.paymentDetails[kind] = {
            date: f.get("date"),
            method: f.get("method"),
            reference: f.get("reference"),
          };
          state.programmes[id] = p;
          save();
          await saveChain;
          render();
        };
      }),
  );
  $("#coach-booking-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const slot = workflow(c().id).slots[
      Number(new FormData(e.target).get("slot"))
    ];
    if (!slotAvailable(c().id, slot.date, slot.time, 30))
      return toast("That slot is no longer available.");
    workflow(c().id).booking = { ...slot };
    save();
    await saveChain;
    render();
  });
}
async function refreshWorkspaceState() {
  const r = await api("/api/state");
  Object.assign(state, r.state);
  window.__revision = r.revision;
  window.__serverBase = structuredClone(r.state);
  lastSaved = JSON.stringify(r.state);
}
async function loadPrivateOnboarding() {
  const token = new URL(location.href).searchParams.get("onboarding");
  const request = (method = "GET", data) =>
    api("/api/onboarding-access", {
      method,
      headers: { "X-Onboarding-Token": token },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
  try {
    const data = await request();
    layout(
      `<h1>Welcome, ${escapeText(data.name)}</h1><p>Your private onboarding page. You do not need a CRM account yet.</p><details class="onboarding-agreement" ${data.agreement ? "" : "open"}><summary>Service Agreement ${data.agreement ? "· Acknowledged" : ""}</summary><div class="terms-copy">${escapeText(data.terms || "Rituparna is finalising your Service Agreement. Please wait for confirmation before paying.")}</div>${data.approved && !data.agreement ? '<form id="private-agree"><label>Full Name</label><input name="name" required maxlength="200"><label><input type="checkbox" required> I have read and agree to these terms.</label><p class="small muted">This records acknowledgement by the holder of this private link; it does not independently verify identity.</p><button class="btn primary">Acknowledge Service Agreement</button></form>' : ""}</details>${data.deposit ? `<h2>Your Onboarding Questionnaire</h2><p>Save your progress, then submit when all answers are complete.</p><form id="private-intake">${data.questions.map((q, i) => `${i % 6 === 0 ? `<details ${i === 0 ? "open" : ""}><summary>${pillars[Math.floor(i / 6)]}</summary>` : ""}<div class="field"><label for="private-answer-${i}">${i + 1}. ${escapeText(q)}</label><textarea id="private-answer-${i}" name="q${i}" maxlength="10000" ${data.intake?.submitted ? "readonly" : ""}>${escapeText(data.intake?.answers?.[i] || "")}</textarea></div>${i % 6 === 5 ? "</details>" : ""}`).join("")}${data.intake?.submitted ? '<p class="note">Your answers have been received. Your personalised plan will be prepared within three business days.</p>' : '<div class="actions"><button class="btn" name="intent" value="draft">Save Progress</button><button class="btn primary" name="intent" value="submit">Submit Questionnaire</button></div>'}</form>` : '<p class="note">Your questionnaire opens here once your CAD 150 deposit is verified. Rituparna will send payment instructions by email.</p>'}<p id="auth-error" role="alert"></p>`,
    );
    document
      .querySelector("#private-agree")
      ?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const b = e.target.querySelector("button");
        b.disabled = true;
        try {
          await request("POST", {
            action: "agree",
            name: new FormData(e.target).get("name"),
            accept: true,
            version: data.version,
          });
          await loadPrivateOnboarding();
        } catch (err) {
          error(err.message);
          b.disabled = false;
        }
      });
    document
      .querySelector("#private-intake")
      ?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submit = e.submitter?.value === "submit";
        const f = new FormData(e.target),
          answers = data.questions.map((_, i) => String(f.get("q" + i) || ""));
        if (submit && answers.some((a) => !a.trim())) {
          const i = answers.findIndex((a) => !a.trim());
          const field = document.querySelector("#private-answer-" + i);
          field.closest("details").open = true;
          field.focus();
          return error("Please answer every question before submitting.");
        }
        const b = e.submitter;
        b.disabled = true;
        try {
          await request("POST", { action: "intake", answers, submit });
          await loadPrivateOnboarding();
        } catch (err) {
          error(err.message);
          b.disabled = false;
        }
      });
  } catch (err) {
    layout(
      `<h1>Private Onboarding</h1><p>${escapeText(err.message)}</p><p>Please contact seekbyritu@gmail.com if you need a new link.</p>`,
    );
  }
}
