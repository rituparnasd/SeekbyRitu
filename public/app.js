const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const day = new Date().toISOString().slice(0, 10);
const clients = [];
const bilingualPlans = [];
const saved = window.__initialState || {};
let state = {
  ...saved,
  view: window.__session.role === "coach" ? "overview" : "today",
  mode: window.__session.role,
  client: window.__session.role === "client" ? window.__session.id : "",
  tab: "Morning",
  period: "week",
};
state.leads ??= [];
state.programmes ??= {};
state.practicePlans ??= {};
state.practiceTicks ??= {};
state.dailyMaterials ??= {};
state.materialProgress ??= {};
state.intakes ??= {};
state.customPlans ??= {};
state.languages ??= {};
state.localizedEdits ??= {};
state.records ??= {};
state.journals ??= {};
state.edits ??= {};
state.checkins ??= {};
state.agreements ??= {};
state.notes ??= {};
const c = () =>
  clients.find((x) => x.id === state.client) ||
  clients[0] || {
    id: "",
    name: "No Client Selected",
    initials: "",
    background: "",
    goal: "",
    identity: "",
    difficulty: "",
    day: 1,
    baseline: [],
    current: [],
  };
const hi = () => false;
const t = (en, roman) => (hi() ? roman : en);
const habits = () =>
  (
    state.customPlans?.[c().id] ||
    bilingualPlans[clients.indexOf(c())]?.en ||
    []
  ).map(
    (h, i) => state.localizedEdits?.[c().id]?.[hi() ? "hi" : "en"]?.[i] || h,
  );
const key = () => `${c().id}:${day}`;
const statuses = () => state.records[key()] || {};
const status = (i) => statuses()[i] || "pending";
const done = () => Object.values(statuses()).filter((x) => x === "done").length;
let saveError = "",
  pendingSaves = 0;
window.addEventListener("beforeunload", (e) => {
  if (pendingSaves || saveError) {
    e.preventDefault();
    e.returnValue = "";
  }
});
let lastSaved = JSON.stringify(saved),
  saveChain = Promise.resolve();
function save() {
  const snapshot = JSON.stringify(
    Object.fromEntries(
      Object.entries(state).filter(
        ([k]) =>
          ![
            "view",
            "mode",
            "client",
            "tab",
            "period",
            "calendarMode",
            "calendarDate",
            "calendarClient",
            "languages",
          ].includes(k),
      ),
    ),
  );
  if (snapshot === lastSaved) return;
  const base = JSON.parse(lastSaved);
  lastSaved = snapshot;
  pendingSaves++;
  saveChain = saveChain
    .then(async () => {
      const r = await fetch("/api/state", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": window.__session.csrf,
        },
        body: JSON.stringify({
          revision: window.__revision,
          state: JSON.parse(snapshot),
          base,
        }),
      });
      const result = await r.json();
      if (!r.ok) {
        lastSaved = JSON.stringify(window.__serverBase || saved);
        document.querySelector("#save-status").textContent =
          "NOT SAVED — " + result.error;
        throw Error(result.error);
      }
      saveError = "";
      window.__revision = result.revision;
      window.__serverBase = result.state || JSON.parse(snapshot);
      if (result.state && lastSaved === snapshot) {
        for (const section of ["outbox", "workflow", "programmes"])
          state[section] = result.state[section];
      }
      document.querySelector("#save-status").textContent =
        "Saved securely on server";
    })
    .catch((e) => {
      saveError = e.message;
      lastSaved = JSON.stringify(window.__serverBase || saved);
      document.querySelector("#save-status").textContent =
        "NOT SAVED — " + e.message;
    })
    .finally(() => {
      pendingSaves--;
    });
  return saveChain;
}
function toast(message) {
  $(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 3500);
}
const button = (label, action, cls = "") =>
  `<button class="btn ${cls}" data-action="${action}">${label}</button>`;
function render() {
  const coach = state.mode === "coach";
  const nav = coach
    ? [
        ["overview", "Today’s Work"],
        ["emails", "Email Center"],
        ["documents", "Documents"],
        ["catalogue", "Products & Services"],
        ["billing", "Billing"],
        ["leads", "Leads & Enrollment"],
        ["clients", "Clients"],
        ["calendar", "Calendar"],
        ["practices", "Daily Practices"],
        ["habits", "Plan & Habits"],
        ["records", "Daily Records"],
        ["journals", "Journals"],
        ["resources", "Resource Library"],
        ["reports", "Progress Reports"],
        ["agreement", "Service Agreements"],
        ["notes", "Coach Notes"],
      ]
    : [
        ["today", t("My Day", "Mera din")],
        ["onboarding", "Onboarding"],
        ["booking", "Walkthrough Booking"],
        ["practices", "Daily Practices"],
        ["habits", t("Know Your Habits", "Apni habits jaano")],
        ["checkin", t("Check-In", "Check-In")],
        ["journals", t("My Journals", "Mere journals")],
        ["resources", t("My Resources", "Mere resources")],
        ["profile", t("My Profile", "Meri profile")],
        ["reports", t("My Progress", "Meri progress")],
        ["agreement", t("My Agreement", "Mera agreement")],
      ];
  $("#app").innerHTML =
    `<div class="notice">${c().isTest ? "TEST CLIENT PREVIEW · Fictional training records · No live emails/payments" : "PRIVATE WORKSPACE · Server-backed access · Deployment and legal checks required before enrollment"}</div><div class="shell"><aside class="sidebar"><div class="mobile-brand-row"><div class="brand"><img class="brand-logo" src="/assets/seekbyritu-logo.png" alt="Seek by Ritu original logo"><span>SeekbyRitu</span></div><button class="mobile-menu-toggle" aria-expanded="false" aria-controls="workspace-navigation">${t("Menu", "Menu")}</button></div><div class="tag">Conscious action. Real life.</div><nav id="workspace-navigation" class="nav" aria-label="Main navigation">${nav.map(([id, label]) => `<button data-view="${id}" class="${state.view === id ? "active" : ""}">${label}</button>`).join("")}</nav><footer><div class="brand-signature">Seek by Ritu</div>SELF-MASTERY, EVERY DAY.<br>One intention. One next action.</footer></aside><main class="workspace"><header class="topbar"><div><div class="eyebrow">${coach ? "Your coaching studio" : window.__session.role === "coach" ? "COACH PREVIEW · CLIENT WORKSPACE" : "CLIENT WORKSPACE"}</div><span class="small">${coach ? "Welcome back, Rituparna" : esc(c().name) + " · " + t("Day", "Din") + " " + programmeDay(c().id) + " / 30"}</span></div><div class="actions"><select ${window.__session.role === "client" ? "disabled" : ""} id="persona" aria-label="Workspace"><option value="coach" ${coach ? "selected" : ""}>Ritu · Coach workspace</option>${clients.map((x) => `<option value="${x.id}" ${!coach && c().id === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select><span id="save-status" class="save-status">${saveError ? esc("NOT SAVED — " + saveError) : "Server connected"}</span><button class="btn subtle" id="logout">Sign Out</button></div></header><div class="content">${page()}</div></main><nav class="mobile-bottom" aria-label="Quick navigation">${(coach
      ? [
          ["overview", "Home"],
          ["clients", "Clients"],
          ["records", "Records"],
        ]
      : [
          ["today", t("Today", "Aaj")],
          ["checkin", "Check-In"],
          ["journals", t("Journals", "Journals")],
        ]
    )
      .map(
        ([id, label]) =>
          `<button data-view="${id}" ${state.view === id ? 'aria-current="page"' : ""}>${label}</button>`,
      )
      .join(
        "",
      )}<button class="mobile-more" aria-expanded="false" aria-controls="workspace-navigation">${t("More", "Aur")}</button></nav></div>`;
  translateUI();
  bind();
  bindWorkflow();
  bindTasks();
  bindServerActions();
  bindBilling();
  save();
}
function title(k, sub, action = "") {
  return `<div class="heading"><div><div class="eyebrow">SEEK BY RITU / ${state.mode === "coach" ? "STUDIO" : "PERSONAL SPACE"}</div><h1>${k}</h1><div class="muted">${sub}</div></div>${action}</div>`;
}
function selector() {
  return `<div class="field"><label for="client-select">Client record</label><select id="client-select">${clients.map((x) => `<option value="${x.id}" ${c().id === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>`;
}
function page() {
  if (
    !clients.length &&
    ![
      "overview",
      "work",
      "leads",
      "clients",
      "calendar",
      "emails",
      "documents",
      "catalogue",
      "billing",
    ].includes(state.view)
  )
    return title(
      "No Clients Yet",
      "Register your first lead in Leads & Enrollment. No sample users or content are loaded.",
    );
  switch (state.view) {
    case "catalogue":
    case "billing":
      return billingPage();
    case "work":
      return workPage();
    case "emails":
      return emailsPage();
    case "documents":
      return documentsPage();
    case "booking":
      return bookingPage();
    case "leads":
      return leadsPage();
    case "calendar":
      return calendarPage();
    case "practices":
      return practicesPage();
    case "onboarding":
      return onboardingPage();
    case "overview":
      return overview();
    case "clients":
      return clientPage();
    case "today":
      return today();
    case "habits":
      return habitPage();
    case "checkin":
      return checkin();
    case "records":
      return records();
    case "journals":
      return journals();
    case "resources":
      return resources();
    case "reports":
      return reports();
    case "profile":
      return profile();
    case "agreement":
      return agreement();
    case "notes":
      return notes();
    default:
      return overview();
  }
}
function clientRow(x) {
  return `<div class="list-item row"><div class="person"><div class="avatar">${x.initials}</div><div><strong>${esc(x.name)}</strong><div class="small muted">${x.background}</div><span class="badge green">Day ${x.day} of 30</span></div></div><div class="actions"><button class="btn subtle" data-client="${x.id}">Open profile</button><button class="btn subtle" data-preview="${x.id}">View as client</button></div></div>`;
}
function clientPage() {
  return (
    title(
      "People, before paperwork.",
      "Open a record or see the dashboard your client sees.",
    ) +
    `<div class="card"><button class="btn" id="create-test-client">Create Test Client</button><p class="small muted">Fictional training only. Real emails, payments and coaching calls are disabled for this profile.</p>${clients.map(clientRow).join("")}</div>`
  );
}
function habitList(details = false, readonly = false) {
  return habits()
    .map(
      (h, i) =>
        `<div class="habit"><input type="checkbox" aria-label="${esc(h[1])}" data-habit="${i}" ${readonly ? "disabled" : ""} ${status(i) === "done" ? "checked" : ""}><div class="body"><div class="eyebrow">${esc(h[0])}</div><strong class="${status(i) === "done" ? "completed" : ""}">${esc(h[1])}</strong><div class="small muted">${esc(h[2])}</div><details ${details ? "open" : ""}><summary>${t("Know more", "Aur jaano")}</summary><p class="small"><b>${t("Completion", "Complete kab hoga")}:</b> ${esc(h[3])}<br><b>${t("Chosen block", "Chuna hua block")}:</b> ${esc(h[4])}<br><b>${t("Agreed alternative", "Agreed alternative")}:</b> ${esc(h[5])}<br><b>${t("Evidence", "Evidence")}:</b> ${t("Self-report; no private screenshots required.", "Self-report; private screenshots zaroori nahi.")}</p></details></div><select data-status="${i}" ${readonly ? "disabled" : ""} aria-label="Status for ${esc(h[1])}">${[
          ["pending", t("Pending", "Baaki")],
          ["done", t("Done", "Ho gaya")],
          ["adapted", t("Adapted", "Adapt kiya")],
          ["rest", t("Rest/recovery", "Rest/recovery")],
          ["missed", t("Missed", "Miss hua")],
        ]
          .map(
            ([v, l]) =>
              `<option value="${v}" ${status(i) === v ? "selected" : ""}>${l}</option>`,
          )
          .join("")}</select></div>`,
    )
    .join("");
}
function today() {
  if (
    state.mode === "client" &&
    (!programme(c().id).balance || programme(c().id).start > day)
  )
    return title(
      "Your Programme Is Not Active Yet",
      "Complete onboarding and the walkthrough. Your plan appears on your agreed programme start date.",
    );
  return (
    title(
      t("Your day, with intention.", "Aaj ka din, intention ke saath."),
      t(
        "Small, agreed actions. A clear next step.",
        "Chhote, agreed actions. Ek clear agla step.",
      ),
    ) +
    `<div class="hero"><div class="eyebrow">${t("YOUR IDENTITY", "TUMHARI IDENTITY")} · DAY ${programmeDay(c().id)}</div><h2>${esc(identity())}</h2><p>${esc(clientGoal())}</p></div>${practiceCard()}<div class="grid"><div class="card"><div class="row"><h2>${t("Today’s commitments", "Aaj ki commitments")}</h2><span class="badge green">${done()} / ${habits().length} ${t("done", "ho gaye")}</span></div>${habitList()}</div><aside><div class="card"><div class="eyebrow">${t("NEXT CHECK-IN", "AGLA CHECK-IN")}</div><h2>${t("Pause. Notice. Continue.", "Ruko. Dekho. Aage badho.")}</h2><p class="muted small">${t("Your habit statuses are already here. No need to type them again.", "Habit status apne aap aa jayega. Dobara bharna nahi hai.")}</p>${button(t("Open check-in", "Check-In bharo"), "checkin", "primary")}</div><div class="card"><h3>${t("Learn → apply → review", "Seekho → apply karo → review")}</h3><p class="small muted">${t("Your next application and its outcome stay together in Learn & Apply.", "Apna application aur uska result Learn & Apply mein dekho.")}</p>${button(t("Open journals", "Journals kholo"), "journals", "subtle")}</div><div class="note">${t("Only your assigned records are available. Contact your coach if your plan needs adjustment.", "Yeh demo preview hai. Real account access aur private storage enabled nahi hain.")}</div></aside></div>`
  );
}
function habitPage() {
  const coach = state.mode === "coach";
  return (
    title(
      coach
        ? "Personal plans. Clear commitments."
        : t("Know Your Habits.", "Apni habits jaano."),
      coach
        ? "Edit the client plan. Work blocks remain client-chosen."
        : t(
            "Understand the why. Keep your daily tracking simple.",
            "Kyun karna hai, samjho. Roz ka tracker simple rakho.",
          ),
    ) +
    (coach ? selector() : "") +
    `<div class="card">${
      coach
        ? button("Add Habit", "add-habit", "primary") +
          habits()
            .map(
              (h, i) =>
                `<div class="list-item row"><div><span class="eyebrow">${esc(h[0])}</span><h3>${esc(h[1])}</h3><span class="small muted">${esc(h[2])}</span></div><button class="btn" data-edit="${i}">Edit habit</button></div>`,
            )
            .join("")
        : habitList(true)
    }</div><div id="editor"></div>`
  );
}
function checkin() {
  const ck = `${key()}:${state.tab}`,
    previous = state.checkins[ck];
  return (
    title(
      t("A moment to check in.", "Ek chhota sa check-in."),
      t("The same habits. One short update.", "Wahi habits. Ek short update."),
    ) +
    `<div class="tabs">${["Morning", "Midday", "Evening", "Bedtime"].map((x) => `<button class="btn ${state.tab === x ? "active" : ""}" data-tab="${x}">${t(x, { Morning: "Subah", Midday: "Dopahar", Evening: "Shaam", Bedtime: "Sone se pehle" }[x])}${state.checkins[`${key()}:${x}`] ? " ✓" : ""}</button>`).join("")}</div><div class="grid"><div class="card"><h2>${t("Your current progress", "Abhi tak ki progress")}</h2>${practiceSnapshot()}${habitList()}</div><form class="card" id="check-form"><h2>${t("Your update", "Tumhara update")}</h2>${previous ? `<div class="note">${t("Latest submission", "Latest submission")}: ${esc(new Date(previous.at).toLocaleString())}. ${t("Submitting again adds a revision.", "Dobara submit karne par revision save hoga.")}</div>` : ""}<div class="field"><label>${t("How are things?", "Abhi kaisa chal raha hai?")}</label><select name="feeling"><option>On track</option><option>Need an adjustment</option><option>Need coach support</option></select></div>${state.tab === "Morning" ? `<div class="field"><label>${t("Your personal shukrana", "Aaj ka personal shukrana")}</label><textarea name="gratitude" maxlength="3000">${esc(previous?.gratitude || "")}</textarea></div>` : ""}<div class="field"><label>${t("Where is there a difficulty? (optional)", "Kahan difficulty hai? (optional)")}</label>${habits()
      .map(
        (h, i) =>
          `<label><input type="checkbox" name="difficulty" value="${i}"> ${esc(h[1])}</label>`,
      )
      .join(
        "",
      )}</div><div class="field"><label>${t("One short note and next action (optional)", "Ek short note aur agla action (optional)")}</label><textarea name="note" maxlength="3000">${esc(previous?.note || "")}</textarea></div><div class="note">${t("A commitment is still pending? Record what happened honestly and choose your next action.", "Commitment pending hai? Honestly record karo aur apna next action choose karo.")}</div><button class="btn primary" type="submit">${t("Submit check-in", "Check-In submit karo")}</button></form></div>`
  );
}
function records() {
  return (
    title(
      "Daily Records.",
      "Timestamped check-ins with the habit statuses captured at submission.",
    ) +
    selector() +
    `<div class="card">${
      Object.entries(state.checkins)
        .filter(([k]) => k.startsWith(c().id + ":"))
        .map(
          ([k, v]) =>
            `<div class="list-item"><h3>${esc(k.split(":").slice(1).join(" · "))}</h3><div class="small muted">${esc(new Date(v.at).toLocaleString())} · ${esc(v.feeling)}</div><p>${esc(v.note || "No difficulty reported.")}</p><div class="actions">${habits()
              .map(
                (h, i) =>
                  `<span class="badge">${esc(h[0])}: ${esc(v.snapshot[i] || "pending")}</span>`,
              )
              .join("")}</div></div>`,
        )
        .join("") || '<p class="empty">No check-ins submitted yet.</p>'
    }</div>`
  );
}
function journals() {
  setTimeout(() => loadJournalHistory(), 0);
  const j = state.journals[c().id] || {};
  const coach = state.mode === "coach";
  return (
    title(
      t("Room to reflect.", "Khud ke liye thodi jagah."),
      t(
        "Two separate spaces. Life reflection and learning into action.",
        "Do alag jagah. Life reflection aur learning ko action mein lana.",
      ),
    ) +
    (coach ? selector() : "") +
    `<div class="grid"><form class="card journal-form" data-kind="daily"><span class="eyebrow">DAILY JOURNAL</span><h2>${t("Dear Divine,", "Dear Nirankar,")}</h2><p class="small muted">${t("What happened? How did you respond? What are you sincerely grateful for? What would you change tomorrow?", "Aaj kya hua? Tumne kaise respond kiya? Kis cheez ka sincere shukrana hai? Kal kya badalna hai?")}</p><textarea aria-label="Daily journal" name="body" maxlength="20000" ${coach ? "readonly" : ""}>${esc(j.daily?.body || "")}</textarea><p class="small muted">${j.daily ? esc(new Date(j.daily.at).toLocaleString()) : t("No entry yet.", "Abhi entry nahi hai.")}</p>${!coach ? '<button class="btn primary">' + t("Save journal", "Journal save karo") + "</button>" : ""}</form><form class="card journal-form" data-kind="learn"><span class="eyebrow">LEARN & APPLY</span><h2>${t("Make learning lived.", "Seekha hua, jee kar dekho.")}</h2><div class="field"><label>${t("Resource and what stood out", "Resource aur kaunsi baat yaad rahi")}</label><textarea name="body" maxlength="10000" ${coach ? "readonly" : ""}>${esc(j.learn?.body || "")}</textarea></div><div class="field"><label>${t("My application in the next 24 hours", "Agle 24 hours mein mera application")}</label><textarea name="application" maxlength="3000" ${coach ? "readonly" : ""}>${esc(j.learn?.application || "")}</textarea></div><div class="field"><label>${t("Review: what happened when I applied it?", "Review: apply kiya toh kya hua?")}</label><textarea name="outcome" maxlength="3000" ${coach ? "readonly" : ""}>${esc(j.learn?.outcome || "")}</textarea></div>${!coach ? '<button class="btn primary">' + t("Save learning & application", "Learning aur application save karo") + "</button>" : ""}</form></div><div class="note">Coach access must be disclosed in the agreed privacy terms. No journal text is sent to AI.</div><div class="card"><h2>Previous Entries</h2><div id="journal-history">Loading…</div></div>`
  );
}
const packs = [
  "Thoughts & interpretations",
  "Identity & restrictive labels",
  "Action & outcomes",
  "Communication & support",
  "Systems & habits",
  "Remembrance & responsibility",
];
function reports() {
  setTimeout(loadGeneratedReports, 0);
  let entries = Object.entries(state.records).filter(([k]) =>
    k.startsWith(c().id + ":"),
  );
  let total = entries.length * habits().length,
    completed = entries.reduce(
      (n, [, v]) => n + Object.values(v).filter((x) => x === "done").length,
      0,
    );
  let score = total ? Math.round((completed / total) * 100) : null;
  return (
    title(
      t("Progress you can see.", "Progress jo dikh sake."),
      `${esc(c().name)} · ${t("Recorded activity; baseline measurements pending", "Recorded activity; baseline measurements pending")}`,
      `<div class="actions">${button("Print / Save PDF", "print", "primary")}${button("Download CSV", "csv")}</div>`,
    ) +
    (state.mode === "coach" ? selector() : "") +
    `<div class="hero"><div class="eyebrow">PERSONAL PROGRESS REPORT</div><h2>${esc(c().name)}</h2><p>${esc(clientGoal())}</p><span class="badge">Programme day ${programmeDay(c().id)} · ${day}</span></div><div class="stats"><div class="stat"><span>OBSERVED COMPLETION</span><strong>${score === null ? "—" : score + "%"}</strong><span>${completed} completed / ${total} recorded habit slots</span></div><div class="stat"><span>CHECK-INS SUBMITTED</span><strong>${Object.keys(state.checkins).filter((k) => k.startsWith(c().id + ":")).length}</strong><span>Recorded submissions</span></div><div class="stat"><span>RECORDED DAYS</span><strong>${entries.length}</strong><span>Unrecorded days are missing data</span></div><div class="stat"><span>PROPOSED THRESHOLD</span><strong>95%</strong><span>No automatic refund decision</span></div></div><div class="card"><h2>HRCMS · starting point & direction</h2><p class="small muted">No self-ratings are recorded yet. Missing measurements are shown as —; completion is not a clinical outcome.</p><div class="pillar-grid">${["Health", "Relationships", "Career", "Money", "Spirituality"].map((p, i) => `<div class="pillar"><div class="eyebrow">${p}</div><strong>${c().current[i] ?? "—"}<span class="small"> / 10</span></strong><progress max="10" value="${c().current[i] || 0}" aria-label="${p} self-rating"></progress><span class="small">Baseline ${c().baseline[i] ?? "—"} → ${c().current[i] ?? "—"}</span></div>`).join("")}</div></div><div class="grid"><div class="card"><h2>Actions behind the numbers</h2>${habits()
      .map(
        (h, i) =>
          `<div class="list-item row"><span>${esc(h[1])}</span><span class="badge">${esc(status(i))}</span></div>`,
      )
      .join(
        "",
      )}</div><div class="card"><h2>What needs a conversation?</h2><p>${esc(clientDifficulty())}</p><div class="note">Missing baseline measurements are not inferred. No automated refund decision is made.</div></div></div><div class="card"><h2>Generated Weekly & Day-30 Reports</h2><div id="generated-reports">Loading server reports…</div></div>`
  );
}
function profile() {
  return (
    title(
      t(
        "Your starting point. Your plan.",
        "Tumhara starting point. Tumhara plan.",
      ),
      "Read-only profile · original intake preserved.",
    ) +
    `<div class="card"><div class="person"><div class="avatar">${c().initials}</div><div><h2>${esc(c().name)}</h2><span class="muted">${c().background}</span></div></div><div class="resource"><label>30-day goal</label><p>${esc(clientGoal())}</p><label>Identity statement</label><p>${esc(identity())}</p><label>Reported constraint</label><p>${esc(clientDifficulty())}</p></div><span class="badge green">Client Profile</span><p class="small muted">Submitted onboarding answers are preserved. Contact your coach to request a correction.</p>${button(t("Request correction", "Correction request karo"), "correction")}</div><div class="card"><h2>Assigned Plan</h2>${habitList(true, true)}</div>${state.mode === "coach" ? profileEditor() : ""}`
  );
}
function notes() {
  return (
    title(
      "A private space for your judgement.",
      "Private notes are restricted to the coach by the server.",
    ) +
    selector() +
    `<form class="card" id="notes-form"><h2>Call preparation & private notes</h2><div class="note">Suggested discussion: ${esc(clientDifficulty())} Ask what happened, what support would help, and agree the next action.</div><textarea name="body" aria-label="Private coach notes" maxlength="20000">${esc(state.notes[c().id] || "")}</textarea><button class="btn primary">Save Coach Note</button></form>`
  );
}
function navigate(view) {
  state.view = view;
  render();
  window.scrollTo(0, 0);
}
function bind() {
  $("#logout")?.addEventListener("click", async () => {
    await saveChain;
    await fetch("/api/logout", {
      method: "POST",
      headers: { "X-CSRF-Token": window.__session.csrf },
    });
    location.reload();
  });
  document.querySelectorAll(".mobile-menu-toggle,.mobile-more").forEach(
    (el) =>
      (el.onclick = () => {
        const open = $(".sidebar").classList.toggle("mobile-menu-open");
        document
          .querySelectorAll(".mobile-menu-toggle,.mobile-more")
          .forEach((b) => b.setAttribute("aria-expanded", String(open)));
        if (open) {
          window.scrollTo({ top: 0, behavior: "smooth" });
          $("#workspace-navigation button")?.focus();
        }
      }),
  );
  document
    .querySelectorAll("[data-view]")
    .forEach((el) => (el.onclick = () => navigate(el.dataset.view)));
  $("#persona").onchange = (e) => {
    state.mode = e.target.value === "coach" ? "coach" : "client";
    if (state.mode === "client") {
      state.client = e.target.value;
      state.languages[c().id] ??= c().language;
    }
    state.view = state.mode === "coach" ? "overview" : "today";
    render();
  };
  $("#language")?.addEventListener("change", (e) => {
    captureDrafts();
    state.languages[c().id] = e.target.value;
    save();
    render();
    restoreDrafts();
  });
  $("#client-select")?.addEventListener("change", (e) => {
    state.client = e.target.value;
    save();
    render();
  });
  document.querySelectorAll("[data-client]").forEach(
    (el) =>
      (el.onclick = () => {
        state.client = el.dataset.client;
        navigate("profile");
      }),
  );
  document.querySelectorAll("[data-preview]").forEach(
    (el) =>
      (el.onclick = () => {
        state.client = el.dataset.preview;
        state.mode = "client";
        state.languages[c().id] ??= c().language;
        navigate("today");
      }),
  );
  document.querySelectorAll("[data-action]").forEach(
    (el) =>
      (el.onclick = () => {
        const a = el.dataset.action;
        if (a === "add-habit") {
          editNewHabit();
          return;
        }
        if (a === "print") {
          window.print();
          return;
        }
        if (a === "csv") {
          exportCSV();
          return;
        }
        if (a === "correction") {
          toast(
            t(
              "Contact your coach to request a correction; original submissions are preserved.",
              "Demo: correction request coach ko send nahi hoti.",
            ),
          );
          return;
        }
        navigate(a);
      }),
  );
  document
    .querySelectorAll("[data-habit]")
    .forEach(
      (el) =>
        (el.onchange = () =>
          setStatus(el.dataset.habit, el.checked ? "done" : "pending")),
    );
  document
    .querySelectorAll("[data-status]")
    .forEach(
      (el) => (el.onchange = () => setStatus(el.dataset.status, el.value)),
    );
  document.querySelectorAll("[data-tab]").forEach(
    (el) =>
      (el.onclick = () => {
        state.tab = el.dataset.tab;
        render();
      }),
  );
  $("#check-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const k = `${key()}:${state.tab}`,
      old = state.checkins[k];
    state.checkins[k] = {
      at: new Date().toISOString(),
      note: f.get("note"),
      gratitude: f.get("gratitude"),
      feeling: f.get("feeling"),
      difficulties: f.getAll("difficulty"),
      snapshot: { ...statuses() },
      practiceSnapshot: { ...(state.practiceTicks[key()] || {}) },
      history: old
        ? [...(old.history || []), { ...old, history: undefined }]
        : [],
    };
    save();
    render();
    toast(
      t(
        "Check-In saved. Your habit statuses were captured.",
        "Check-In save ho gaya. Habit statuses bhi record ho gaye.",
      ),
    );
  });
  document.querySelectorAll(".journal-form").forEach(
    (form) =>
      (form.onsubmit = (e) => {
        e.preventDefault();
        if (state.mode === "coach") return;
        const f = new FormData(form),
          kind = form.dataset.kind;
        state.journals[c().id] ??= {};
        state.journals[c().id][kind] = {
          body: f.get("body"),
          application: f.get("application"),
          outcome: f.get("outcome"),
          at: new Date().toISOString(),
        };
        save();
        toast(t("Saved to server.", "Is demo browser mein save ho gaya."));
      }),
  );
  document
    .querySelectorAll("[data-edit]")
    .forEach((el) => (el.onclick = () => editHabit(Number(el.dataset.edit))));
  $("#notes-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    state.notes[c().id] = new FormData(e.target).get("body");
    save();
    toast("Coach note saved.");
  });
}
function setStatus(i, value) {
  state.records[key()] ??= {};
  state.records[key()][i] = value;
  save();
  render();
}
function editHabit(i) {
  const h = habits()[i];
  $("#editor").innerHTML =
    `<form id="habit-editor" class="card"><h2>Edit ${esc(h[0])} habit</h2><p class="small muted">Agree significant plan changes with the client before publishing.</p>${["HRCMS pillar", "Short habit name", "Why it matters", "Completion standard", "Client-chosen work block", "Agreed alternative"].map((label, n) => `<div class="field"><label for="habit-field-${n}">${label}</label><input id="habit-field-${n}" name="f${n}" maxlength="1000" value="${esc(h[n])}" required></div>`).join("")}<div class="actions"><button class="btn primary">Save Habit</button><button class="btn" type="button" id="cancel-edit">Cancel</button></div></form>`;
  $("#editor").scrollIntoView({ behavior: "smooth" });
  $("#cancel-edit").onclick = () => {
    $("#editor").innerHTML = "";
  };
  $("#habit-editor").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    state.localizedEdits[c().id] ??= {};
    state.localizedEdits[c().id][hi() ? "hi" : "en"] ??= {};
    state.localizedEdits[c().id][hi() ? "hi" : "en"][i] = Array.from(
      { length: 6 },
      (_, n) => f.get("f" + n),
    );
    save();
    render();
    toast("Habit updated.");
  };
}
function exportCSV() {
  const rows = [["Client", "Date", "Pillar", "Habit", "Status"]];
  Object.entries(state.records)
    .filter(([k]) => k.startsWith(c().id + ":"))
    .forEach(([k, v]) =>
      habits().forEach((h, i) =>
        rows.push([c().name, k.split(":")[1], h[0], h[1], v[i] || "pending"]),
      ),
    );
  if (rows.length === 1) {
    toast(
      "No recorded activity to export. Update a habit in the client preview first.",
    );
    return;
  }
  const csv = rows
    .map((row) =>
      row
        .map(
          (x) =>
            '"' +
            String(x)
              .replace(/^[=+@\-]/, "'$&")
              .replace(/"/g, '""') +
            '"',
        )
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `seek-${c().id}-${day}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function identity() {
  return c().identity || "Identity statement not assigned.";
}
function clientGoal() {
  return c().goal || "Goal not assigned.";
}
function practiceCard() {
  return `<section class="card"><div class="eyebrow">IDENTITY INTO ACTION</div><h2>Daily Practices</h2><p>Coach-assigned practices are separate from your HRCMS habits. Affirmations, remembrance and reflection appear only as assigned.</p><div class="actions">${
    assignedPractices()
      .map((p) => `<span class="badge">${esc(p.name)}</span>`)
      .join("") || '<span class="muted">No practices assigned yet.</span>'
  }</div><br>${button("Open Daily Practices", "practices", "primary")}</section>`;
}
let drafts = {};
function captureDrafts() {
  drafts = {};
  document.querySelectorAll("form").forEach((f) => {
    drafts[f.id || f.dataset.kind] = Array.from(f.elements).map((e) => ({
      name: e.name,
      value: e.value,
      checked: e.checked,
      type: e.type,
    }));
  });
}
function restoreDrafts() {
  document.querySelectorAll("form").forEach((f) => {
    const values = drafts[f.id || f.dataset.kind];
    if (!values) return;
    Array.from(f.elements).forEach((e, i) => {
      const v = values[i];
      if (!v || e.name !== v.name) return;
      if (e.type === "checkbox") e.checked = v.checked;
      else if (!["submit", "button"].includes(e.type)) e.value = v.value;
    });
  });
}
function translateUI() {
  document.documentElement.lang = "en";
}
const intakeQuestions = [
  "What did your eating, movement, sleep and energy actually look like over the past seven days?",
  "What one health-related improvement matters most to you, and what observable progress would be realistic within 30 days?",
  "Describe a recent moment when a thought, feeling or expectation influenced how you cared for your health.",
  "What existing strengths, routines, resources or support can you use to improve your health?",
  "What could interfere with your health plan, including knowledge, time, access, health limitations or existing professional guidance?",
  "What specific health action can you commit to, when and where will you do it, and what will you do if your usual plan is disrupted?",
  "What did connection, communication and boundaries look like in your important relationships over the past seven days?",
  "What one improvement in your own relationship behaviour matters most, and what observable progress would you aim for within 30 days?",
  "Describe a recent interaction where your interpretation or an unspoken expectation influenced your response.",
  "What strengths, supportive connections or communication practices can you build on?",
  "What makes your desired relationship behaviour difficult, including skills, circumstances, safety or another person\u2019s choices?",
  "What specific relationship action can you commit to, when will you practise it, and what will you do if the other person responds differently than you hope?",
  "What actions and results describe your work, business, study, caregiving or other purposeful activity over the past seven days?",
  "What one improvement in this area matters most, and what observable progress would be realistic within 30 days?",
  "Describe a recent moment when uncertainty, feedback or an outcome influenced how you viewed yourself or acted.",
  "What strengths, skills, experience, resources or connections can you build on?",
  "What currently limits progress, including knowledge, opportunity, time, resources or a recurring behaviour?",
  "What specific action can you commit to, when and where will you do it, and what will you do if your first approach is unavailable or unsuccessful?",
  "What do you currently know about your income or support, spending, savings and financial obligations, and what remains unclear?",
  "What one financial improvement matters most, and what observable progress would be realistic within 30 days?",
  "Describe a recent money decision where an emotion, assumption or social expectation influenced your choice.",
  "What financial habits, knowledge, resources or support can you build on?",
  "What limits your financial progress, including essential costs, income constraints, access, knowledge or avoidance?",
  "What specific financial action can you commit to, when will you do it, and what will you do if circumstances disrupt your plan?",
  "What did remembrance, spiritual learning, shukrana and service actually look like in your life over the past seven days?",
  "What one change in how you live your spiritual understanding matters most, and what observable progress would you aim for within 30 days?",
  "Describe a recent situation where expectations, attachment or your understanding of self and Nirankar influenced your response.",
  "What existing practices, teachings, experiences or supportive community can you build on?",
  "What makes spiritual understanding difficult to practise in ordinary life, including confusion, habits, circumstances or competing demands?",
  "What specific spiritual practice and everyday application can you commit to, when will you practise them, and how will you return after a lapse?",
];
function clientDifficulty() {
  return c().difficulty || "No constraint recorded yet.";
}
function dateAdd(date, days) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function programme(id) {
  return (
    state.programmes[id] || {
      status: "Not Activated",
      start: day,
      time: "10:00",
      deposit: false,
      balance: false,
      agreed: false,
    }
  );
}
function programmeDay(id) {
  const p = programme(id);
  if (p.status === "Not Activated")
    return clients.find((x) => x.id === id)?.day || 1;
  const at = p.status === "On Hold" ? p.held : day;
  return Math.max(
    1,
    Math.min(
      30,
      Math.floor(
        (Date.parse(at + "T12:00:00Z") - Date.parse(p.start + "T12:00:00Z")) /
          86400000,
      ) + 1,
    ),
  );
}
function callsFor(id) {
  const p = programme(id);
  if (!["Active", "On Hold", "Ended"].includes(p.status)) return [];
  return (
    p.calls ||
    Array.from({ length: 10 }, (_, i) => ({
      id,
      number: i + 1,
      programmeDay: (i + 1) * 3,
      date: dateAdd(p.start, (i + 1) * 3 - 1),
      time: p.time || "10:00",
    }))
  ).filter((x) => p.status === "Active" || x.date < (p.held || day));
}
function allCalls() {
  return clients
    .flatMap((x) => callsFor(x.id))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
function callConflict(id, proposed) {
  return callsFor(id).some((x) =>
    calendarEvents().some(
      (y) =>
        !y.nonblocking &&
        (y.id !== id || y.label !== "Coaching Call") &&
        y.date === x.date &&
        minutes(x.time) < minutes(y.time) + (y.duration || 20) &&
        minutes(x.time) + 20 > minutes(y.time),
    ),
  );
}
function minutes(v) {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}
function moneyPanel(id) {
  const p = programme(id),
    intake = state.intakes[id];
  return `<div class="actions"><button class="btn subtle" data-payment="${id}" data-kind="deposit">${p.deposit ? "Deposit Confirmed" : "Confirm $150 Deposit"}</button><button class="btn subtle" data-payment="${id}" data-kind="agreed">${p.agreed ? "Plan Agreed" : "Record Plan Agreement"}</button><button class="btn subtle" data-payment="${id}" data-kind="balance">${p.balance ? "Balance Confirmed" : "Confirm $350 Balance"}</button><button class="btn subtle" data-intake="${id}">View Questionnaire</button></div><p class="small muted">Questionnaire: ${intake?.submitted ? "Submitted" : intake ? "Draft" : "Not Started"} · Total $500; currency and final terms pending. Payments are manually verified; no bank connection is enabled.</p>`;
}
function leadsPage() {
  return (
    title(
      "Leads & Enrollment",
      "Register, prepare onboarding, agree the plan, and activate the programme.",
    ) +
    `<div class="grid"><form id="lead-form" class="card"><h2>Register Lead</h2><div class="form-grid">${[
      ["first", "First Name"],
      ["last", "Last Name"],
      ["email", "Email"],
      ["phone", "Phone Number"],
    ]
      .map(
        ([n, l]) =>
          `<div class="field"><label for="lead-${n}">${l}</label><input id="lead-${n}" name="${n}" type="${n === "email" ? "email" : n === "phone" ? "tel" : "text"}" required maxlength="200"></div>`,
      )
      .join(
        "",
      )}</div><div class="field"><label>Inquiry Source</label><select name="source"><option>WhatsApp</option><option>Email</option><option>Other</option></select></div><button class="btn primary">Register Lead</button><div class="note">Lead information is stored on the configured server. Email sending requires verified provider and approved business settings.</div></form><div class="card"><h2>Enrollment Sequence</h2><p>Inquiry → $150 deposit → onboarding questions → consultation and plan → client agreement → $350 balance → account invitation → Day 1.</p><p class="small muted">One onboarding week is separate from the 30 tracking days. The remaining $350 is due by the day before the agreed start. A late payment requires a new start date.</p></div></div><div class="card">${clients
      .map((x) => {
        const l = state.leads.find((y) => y.id === x.id),
          p = programme(x.id);
        return `<div class="list-item"><div class="row"><h3>${esc(x.name)}</h3><span class="badge green">${esc(p.status === "Not Activated" ? (p.balance ? "Ready For Activation" : p.agreed ? "Awaiting Balance" : state.intakes[x.id]?.submitted ? "Plan Preparation" : p.deposit ? "Onboarding" : "Awaiting Deposit") : p.status)}</span></div>${l ? `<p class="small muted">${esc(l.email)} · ${esc(l.phone)} · ${esc(l.source)}</p><a class="btn subtle" href="${esc(firstStepsMail(l))}">Open First-Steps Email Draft</a>` : '<p class="small muted">No email address recorded</p>'}${moneyPanel(x.id)}${documentControls(x.id)}<div class="actions"><button class="btn subtle" data-client="${x.id}">Open Profile</button><button class="btn subtle" data-manage="${x.id}">Manage Programme & Calls</button></div></div>`;
      })
      .join("")}</div>`
  );
}
function firstStepsMail(l) {
  return (
    "mailto:" +
    encodeURIComponent(l.email) +
    "?subject=" +
    encodeURIComponent("Seek by Ritu — Your First Steps") +
    "&body=" +
    encodeURIComponent(
      `Hello ${l.first},\n\nWelcome to Seek by Ritu. Your programme includes one onboarding week followed by 30 coaching days.\n\n1. Review and accept the final programme and payment terms.\n2. Pay the $150 deposit using the instructions Ritu provides.\n3. After payment confirmation, complete the private onboarding questionnaire supplied by Ritu.\n4. We will discuss your personalised habits, daily practices, resources and work blocks.\n5. The remaining $350 is due by the day before your agreed programme start date.\n\nThis is a draft: currency, approved payment destination, final terms and private questionnaire link must be added before sending.\n\nRitu\nSeek by Ritu`,
    )
  );
}
function calendarPage() {
  const mode = state.calendarMode || "Week",
    anchor = state.calendarDate || day;
  const list = calendarEvents().filter(
    (x) =>
      (!state.calendarClient || x.id === state.calendarClient) &&
      (mode === "Day"
        ? x.date === anchor
        : mode === "Week"
          ? x.date >= anchor && x.date <= dateAdd(anchor, 6)
          : x.date.slice(0, 7) === anchor.slice(0, 7)),
  );
  return (
    title(
      "Calendar",
      "20-minute calls on programme days 3, 6, 9 … 30. Calendar uses UTC; no external calendar is connected.",
    ) +
    `<div class="card"><div class="row"><div class="tabs">${["Day", "Week", "Month"].map((m) => `<button class="btn ${mode === m ? "primary" : ""}" data-calendar-mode="${m}">${m}</button>`).join("")}</div><div class="actions"><input type="date" id="calendar-date" aria-label="Calendar date" value="${anchor}"><select id="calendar-client" aria-label="Filter client"><option value="">All Clients</option>${clients.map((x) => `<option value="${x.id}" ${state.calendarClient === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div></div>${mode === "Month" ? monthGrid(anchor, list) : ""}${list.length ? list.map((x) => `<div class="list-item row"><div><h3>${esc(clients.find((c) => c.id === x.id)?.name)}</h3><span class="muted small">${x.date} · ${x.time} UTC · ${x.nonblocking ? "Deadline" : (x.duration || 20) + " minutes"} · ${esc(x.label || "Coaching Call")}${x.programmeDay ? " · Programme Day " + x.programmeDay : ""}</span></div><button class="btn subtle" data-call-client="${x.id}">Prepare Call</button></div>`).join("") : '<div class="empty">No calls in this view. Activate a programme below, or change the date range.</div>'}</div><div class="card"><h2>Programme Controls</h2><p class="small muted">Confirm deposit, questionnaire, plan agreement and balance in Leads & Enrollment before activation. Choose one agreed recurring time; overlapping calls are rejected. Future calls disappear on hold and return shifted by the hold duration on resume.</p>${clients
      .map((x) => {
        const p = programme(x.id);
        return `<form class="programme-form list-item" data-id="${x.id}"><div class="row"><h3>${esc(x.name)}</h3><span class="badge">${esc(p.status)}</span></div><div class="form-grid"><div class="field"><label>Agreed Programme Start</label><input name="start" type="date" value="${p.start}" required></div><div class="field"><label>Agreed Call Time (UTC)</label><input name="time" type="time" value="${p.time}" required></div></div><div class="actions"><button class="btn primary">${p.status === "Not Activated" ? "Activate Programme" : "Update Future Schedule"}</button>${p.status === "Active" ? `<button class="btn" type="button" data-hold="${x.id}">Put On Hold</button>` : ""}${p.status === "On Hold" ? `<button class="btn" type="button" data-resume="${x.id}">Resume Programme</button>` : ""}${["Active", "On Hold"].includes(p.status) ? `<button class="btn" type="button" data-end="${x.id}">End Programme</button>` : ""}</div></form>`;
      })
      .join("")}</div>`
  );
}
function monthGrid(anchor, calls) {
  const y = Number(anchor.slice(0, 4)),
    m = Number(anchor.slice(5, 7));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return `<div class="calendar-grid">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<strong>${d}</strong>`).join("")}${Array.from({ length: offset }, () => "<div></div>").join("")}${Array.from(
    { length: days },
    (_, i) => {
      const d = anchor.slice(0, 8) + String(i + 1).padStart(2, "0");
      return `<div class="calendar-cell"><b>${i + 1}</b>${calls
        .filter((x) => x.date === d)
        .map(
          (x) =>
            `<span>${esc(clients.find((c) => c.id === x.id).name.split(" ")[0])} ${x.time}</span>`,
        )
        .join("")}</div>`;
    },
  ).join("")}</div>`;
}
const windows = ["Morning", "Midday", "Evening", "Bedtime"];
function assignedPractices() {
  return state.practicePlans[c().id] || [];
}
function practicesPage() {
  const coach = state.mode === "coach";
  const tickKey = key();
  return (
    title(
      "Daily Practices",
      coach
        ? "Manually assign the four-window routine separately from HRCMS habits."
        : "Your assigned practices. Four agreed windows; no repeated long reports.",
    ) +
    (coach ? selector() : "") +
    `<div class="card">${
      assignedPractices()
        .map(
          (p, i) =>
            `<div class="list-item"><div class="row"><h3>${esc(p.name)}</h3>${coach ? `<button class="btn subtle" data-delete-practice="${i}">Remove Assignment</button>` : ""}</div><p>${esc(p.instructions)}</p><div class="practice-windows">${p.windows.map((w) => (coach ? `<span class="badge">${w}</span>` : `<label><input type="checkbox" data-practice="${esc(p.id)}" data-window="${w}" ${state.practiceTicks[tickKey]?.[p.id + ":" + w] ? "checked" : ""}> ${w}</label>`)).join("")}</div></div>`,
        )
        .join("") || "<p>No practices assigned.</p>"
    }</div>${coach ? `<form id="practice-form" class="card"><h2>Assign Practice</h2><div class="field"><label>Practice Name</label><input name="name" required maxlength="200"></div><div class="field"><label>Personalised Instructions</label><textarea name="instructions" required maxlength="5000"></textarea></div><div class="practice-windows">${windows.map((w) => `<label><input type="checkbox" name="windows" value="${w}" checked> ${w}</label>`).join("")}</div><p class="small muted">Assign Simran only where appropriate and agreed. Do not invent sacred wording or impose a practice based on ethnicity.</p><button class="btn primary">Assign To ${esc(c().name)}</button></form>` : ""}`
  );
}
function materials() {
  return (
    state.dailyMaterials[c().id] ||
    Array.from({ length: 30 }, (_, i) => ({
      title: "Day " + (i + 1) + ": Not Assigned",
      body: "",
      requirement: "",
      coachReview: true,
      locked: true,
    }))
  );
}
function resources() {
  const coach = state.mode === "coach",
    pd = programmeDay(c().id),
    progress = state.materialProgress[c().id] || {};
  return (
    title(
      coach ? "Daily Resource Assignments" : "My Resources",
      coach
        ? "Assign 30 daily materials. Future content stays hidden from clients."
        : "Complete the current material before the next scheduled day unlocks.",
    ) +
    (coach ? selector() : "") +
    `<div class="card">${materials()
      .map((m, i) => {
        const unlocked =
          !m.locked && i < pd && (i === 0 || progress[i - 1]?.approved);
        return `<div class="resource"><div class="row"><h3>${coach || unlocked ? esc(m.title) : `Day ${i + 1}: Material Locked`}</h3><span class="badge">${progress[i]?.approved ? "Completed" : coach ? "Coach Draft" : unlocked ? "Available" : "Locked"}</span></div>${coach ? `<button class="btn subtle" data-edit-material="${i}">Edit Material</button>${progress[i]?.submitted && !progress[i]?.approved ? ` <button class="btn subtle" data-approve-material="${i}">Approve Completion</button>` : ""}${progress[i]?.submitted ? `<p class="small">Client submission: ${esc(progress[i].learning)}<br>Application: ${esc(progress[i].application)}<br>Review: ${esc(progress[i].review)}</p>` : ""}` : unlocked ? `<p>${esc(m.body)}</p><p class="small muted">${esc(m.requirement)}</p>${progress[i]?.approved ? "<p>Completion recorded.</p>" : `<form class="material-form" data-day="${i}"><label>What Did You Learn?</label><textarea name="learning" required maxlength="5000">${esc(progress[i]?.learning || "")}</textarea><label>How Did You Apply It?</label><textarea name="application" required maxlength="5000">${esc(progress[i]?.application || "")}</textarea><label>What Happened?</label><textarea name="review" required maxlength="5000">${esc(progress[i]?.review || "")}</textarea><button class="btn primary">${m.coachReview ? "Submit For Coach Review" : "Record Required Completion"}</button></form>`}` : ""}</div>`;
      })
      .join(
        "",
      )}</div><div id="material-editor"></div><div class="note">Server access rules protect unreleased material. Assign authorised resources and completion requirements before release.</div>`
  );
}
function onboardingPage() {
  const coach = state.mode === "coach",
    entry = state.intakes[c().id] || {};
  if (!programme(c().id).deposit)
    return (
      title(
        "Onboarding",
        "Questionnaire access opens after deposit confirmation.",
      ) +
      (coach ? selector() : "") +
      '<div class="note">Deposit has not been confirmed. Use Leads & Enrollment to record the verified payment.</div>'
    );
  return (
    title(
      "Onboarding Questionnaire",
      "Original 30-question intake retained until a revised 25-question set is agreed. Submitted answers are read-only.",
    ) +
    (coach ? selector() : "") +
    `<form id="intake-form" class="card">${intakeQuestions.map((q, i) => `<div class="field">${i % 6 === 0 ? `<h2>${["Health", "Relationships", "Career", "Money", "Spirituality"][Math.floor(i / 6)]}</h2>` : ""}<label for="answer-${i}">${i + 1}. ${esc(q)}</label><textarea id="answer-${i}" name="q${i}" maxlength="10000" ${entry.submitted || coach ? "readonly" : ""} ${coach ? "" : "required"}>${esc(entry.answers?.[i] || "")}</textarea></div>`).join("")}${entry.submitted ? `<div class="note">Submitted ${esc(new Date(entry.submitted).toLocaleString())}. Original answers preserved.</div>` : `<div class="actions"><button class="btn" name="intent" value="draft" formnovalidate>Save Draft</button><button class="btn primary" name="intent" value="submit">Submit Questionnaire</button></div>`}</form>`
  );
}
function editNewHabit() {
  const index = habits().length;
  state.customPlans[c().id] = habits().map((h) => [...h]);
  state.customPlans[c().id].push(["Health", "", "", "", "", ""]);
  state.localizedEdits[c().id] ??= {};
  save();
  render();
  editHabit(index);
}
function registerProfile(l) {
  if (clients.some((x) => x.id === l.id)) return;
  clients.push({
    id: l.id,
    name: l.first + " " + l.last,
    initials: (l.first[0] + l.last[0]).toUpperCase(),
    language: "en",
    isTest: !!l.isTest,
    background: l.isTest ? "Fictional Training Profile" : "New Enrollment",
    goal: l.goal || "Plan to be agreed after consultation.",
    identity: l.identity || "Identity statement to be agreed with the client.",
    day: 1,
    baseline: [],
    current: [],
    difficulty: l.difficulty || "Not assessed.",
    habits: [],
  });
}
function bindWorkflow() {
  $("#lead-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const email = f.get("email").trim();
    if (
      state.leads.some((l) => l.email.toLowerCase() === email.toLowerCase())
    ) {
      toast("A lead with that email already exists.");
      return;
    }
    const l = {
      id: crypto.randomUUID(),
      first: f.get("first").trim(),
      last: f.get("last").trim(),
      email,
      phone: f.get("phone").trim(),
      source: f.get("source"),
      created: new Date().toISOString(),
    };
    state.leads.push(l);
    registerProfile(l);
    save();
    render();
    toast("Lead registered. Check Email Center for the next message.");
  });
  document.querySelectorAll("[data-payment]").forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.payment,
          p = programme(id);
        if (p[b.dataset.kind]) {
          toast("Already recorded.");
          return;
        }
        p[b.dataset.kind] = true;
        if (b.dataset.kind === "deposit") workflow(id).depositDate ??= day;
        if (b.dataset.kind === "balance") workflow(id).balanceDate ??= day;
        state.programmes[id] = p;
        save();
        render();
        toast("Coach confirmation recorded. This does not process a payment.");
      }),
  );
  document.querySelectorAll("[data-intake]").forEach(
    (b) =>
      (b.onclick = () => {
        state.client = b.dataset.intake;
        navigate("onboarding");
      }),
  );
  document.querySelectorAll("[data-manage]").forEach(
    (b) =>
      (b.onclick = () => {
        state.calendarClient = b.dataset.manage;
        navigate("calendar");
      }),
  );
  document.querySelectorAll("[data-calendar-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        state.calendarMode = b.dataset.calendarMode;
        save();
        render();
      }),
  );
  $("#calendar-date")?.addEventListener("change", (e) => {
    state.calendarDate = e.target.value || day;
    save();
    render();
  });
  $("#calendar-client")?.addEventListener("change", (e) => {
    state.calendarClient = e.target.value;
    save();
    render();
  });
  document.querySelectorAll("[data-call-client]").forEach(
    (b) =>
      (b.onclick = () => {
        state.client = b.dataset.callClient;
        navigate("notes");
      }),
  );
  document.querySelectorAll(".programme-form").forEach(
    (form) =>
      (form.onsubmit = (e) => {
        e.preventDefault();
        const id = form.dataset.id,
          old = structuredClone(programme(id)),
          p = programme(id),
          f = new FormData(form);
        if (["On Hold", "Ended"].includes(p.status)) {
          toast("Resume the programme before adjusting its schedule.");
          return;
        }
        if (
          !p.deposit ||
          !p.balance ||
          !p.agreed ||
          !state.intakes[id]?.submitted
        ) {
          toast(
            "Deposit, submitted questionnaire, agreed plan and balance are required before activation.",
          );
          return;
        }
        if (p.status === "Active" && p.start !== f.get("start")) {
          toast(
            "An active programme start is preserved. Use hold/resume to shift remaining days.",
          );
          return;
        }
        p.start = f.get("start");
        p.time = f.get("time");
        p.status = "Active";
        p.calls = p.calls
          ? p.calls.map((x) => (x.date >= day ? { ...x, time: p.time } : x))
          : Array.from({ length: 10 }, (_, i) => ({
              id,
              number: i + 1,
              programmeDay: (i + 1) * 3,
              date: dateAdd(p.start, (i + 1) * 3 - 1),
              time: p.time,
            }));
        state.programmes[id] = p;
        if (callConflict(id)) {
          state.programmes[id] = old;
          toast(
            "This schedule overlaps another client call. Choose another time.",
          );
          return;
        }
        save();
        render();
        toast(
          "Programme active. Ten 20-minute calls generated without duplicates.",
        );
      }),
  );
  document.querySelectorAll("[data-hold]").forEach(
    (b) =>
      (b.onclick = () => {
        const p = programme(b.dataset.hold);
        p.status = "On Hold";
        p.held = day;
        state.programmes[b.dataset.hold] = p;
        save();
        render();
        toast("On hold. Upcoming calls removed; earlier calls retained.");
      }),
  );
  document.querySelectorAll("[data-resume]").forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.resume,
          old = structuredClone(programme(id)),
          p = programme(id);
        const shift = Math.max(
          0,
          Math.round((Date.parse(day) - Date.parse(p.held)) / 86400000),
        );
        p.calls = (p.calls || []).map((x) =>
          x.date >= p.held ? { ...x, date: dateAdd(x.date, shift) } : x,
        );
        p.start = dateAdd(p.start, shift);
        p.status = "Active";
        delete p.held;
        state.programmes[id] = p;
        if (callConflict(id)) {
          state.programmes[id] = old;
          toast(
            "Resume would overlap another client call. Adjust the other schedule first.",
          );
          return;
        }
        save();
        render();
        toast("Programme resumed; remaining calls restored.");
      }),
  );
  document.querySelectorAll("[data-end]").forEach(
    (b) =>
      (b.onclick = () => {
        const p = programme(b.dataset.end);
        p.status = "Ended";
        p.held = day;
        state.programmes[b.dataset.end] = p;
        save();
        render();
        toast("Programme ended. Future calls removed.");
      }),
  );
  $("#practice-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      ws = f.getAll("windows");
    if (!ws.length) {
      toast("Choose at least one practice window.");
      return;
    }
    state.practicePlans[c().id] = [
      ...assignedPractices(),
      {
        id: crypto.randomUUID(),
        name: f.get("name"),
        instructions: f.get("instructions"),
        windows: ws,
      },
    ];
    save();
    render();
  });
  document.querySelectorAll("[data-delete-practice]").forEach(
    (b) =>
      (b.onclick = () => {
        state.practicePlans[c().id] = assignedPractices().filter(
          (_, i) => i !== Number(b.dataset.deletePractice),
        );
        save();
        render();
      }),
  );
  document.querySelectorAll("[data-practice]").forEach(
    (b) =>
      (b.onchange = () => {
        state.practiceTicks[key()] ??= {};
        state.practiceTicks[key()][
          b.dataset.practice + ":" + b.dataset.window
        ] = b.checked;
        save();
      }),
  );
  $("#intake-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.intakes[c().id]?.submitted) return;
    const f = new FormData(e.target),
      answers = intakeQuestions.map((_, i) => f.get("q" + i));
    if (e.submitter?.value === "submit" && answers.some((v) => !v?.trim())) {
      toast("Complete all questions before submission.");
      return;
    }
    state.intakes[c().id] = {
      answers,
      updated: new Date().toISOString(),
      submitted:
        e.submitter?.value === "submit" ? new Date().toISOString() : null,
    };
    save();
    render();
    toast("Questionnaire saved to server.");
  });
  document.querySelectorAll("[data-edit-material]").forEach(
    (b) =>
      (b.onclick = () => {
        const i = Number(b.dataset.editMaterial),
          m = materials()[i];
        $("#material-editor").innerHTML =
          `<form id="material-editor-form" class="card"><h2>Edit Day ${i + 1}</h2><label>Title</label><input name="title" required maxlength="300" value="${esc(m.title)}"><label>Material & Instructions</label><textarea name="body" required maxlength="20000">${esc(m.body)}</textarea><label>Completion Requirement</label><textarea name="requirement" required maxlength="5000">${esc(m.requirement)}</textarea><label><input name="review" type="checkbox" ${m.coachReview ? "checked" : ""}> Require Coach Approval</label><button class="btn primary">Save Material</button></form>`;
        $("#material-editor").scrollIntoView({ behavior: "smooth" });
        $("#material-editor-form").onsubmit = (e) => {
          e.preventDefault();
          const f = new FormData(e.target);
          state.dailyMaterials[c().id] = materials().map((x) => ({ ...x }));
          state.dailyMaterials[c().id][i] = {
            title: f.get("title"),
            body: f.get("body"),
            requirement: f.get("requirement"),
            coachReview: f.has("review"),
            locked: false,
          };
          save();
          render();
        };
      }),
  );
  document.querySelectorAll(".material-form").forEach(
    (form) =>
      (form.onsubmit = (e) => {
        e.preventDefault();
        const i = Number(form.dataset.day),
          f = new FormData(form);
        state.materialProgress[c().id] ??= {};
        state.materialProgress[c().id][i] = {
          learning: f.get("learning"),
          application: f.get("application"),
          review: f.get("review"),
          submitted: new Date().toISOString(),
          approved: !materials()[i].coachReview,
        };
        save();
        render();
        toast(
          "Required completion recorded. The next material also needs its scheduled day.",
        );
      }),
  );
  document.querySelectorAll("[data-approve-material]").forEach(
    (b) =>
      (b.onclick = () => {
        const m = state.materialProgress[c().id]?.[b.dataset.approveMaterial];
        if (m) {
          m.approved = true;
          m.reviewedAt = new Date().toISOString();
          save();
          render();
        }
      }),
  );
}

state.leads.forEach(registerProfile);
state.client ||= clients[0]?.id || "";
function practiceSnapshot() {
  const values = state.practiceTicks[key()] || {};
  return `<div class="note"><strong>Daily Practices · ${esc(state.tab)}</strong><br>${
    assignedPractices()
      .filter((p) => p.windows.includes(state.tab))
      .map(
        (p) =>
          `${esc(p.name)}: ${values[p.id + ":" + state.tab] ? "Done" : "Pending"}`,
      )
      .join("<br>") || "No practice assigned in this window."
  }<br><button class="btn subtle" data-action="practices">Open Daily Practices</button></div>`;
}
function workflow(id) {
  state.workflow ??= {};
  return (state.workflow[id] ??= {});
}
function enqueue(id, type, subject, body, due = day) {
  state.outbox ??= {};
  const key = id + ":" + type;
  if (!state.outbox[key])
    state.outbox[key] = {
      id: key,
      client: id,
      type,
      subject,
      body,
      due,
      status: "Draft",
      created: new Date().toISOString(),
    };
}
function syncWork() {
  state.workflow ??= {};
  state.outbox ??= {};
  for (const x of clients) {
    const w = workflow(x.id),
      p = programme(x.id),
      l = state.leads.find((l) => l.id === x.id),
      intake = state.intakes[x.id];
    if (l)
      enqueue(
        x.id,
        "first",
        "Your First Steps",
        "Review your one-page programme agreement and payment terms before paying the $150 deposit. After verification, complete your onboarding questionnaire. Total programme price: $500, currency and final terms to be confirmed. Payment destination must be supplied by Ritu.",
      );
    if (p.deposit) {
      w.depositDate ??= day;
      if (!intake?.submitted)
        enqueue(
          x.id,
          "questionnaire-reminder",
          "Reminder — Complete Your Onboarding",
          "Your questionnaire is pending. Complete it before plan preparation can begin.",
          dateAdd(w.depositDate, 2),
        );
    }
    if (p.deposit)
      enqueue(
        x.id,
        "deposit",
        "Deposit Confirmed — Complete Your Onboarding",
        "Your $150 deposit has been recorded by your coach. Receipt: deposit $150, balance $350. Complete your private questionnaire when your coach provides the secure link. After submission, allow three business days (Saturday and Sunday excluded) for plan preparation.",
      );
    if (intake?.submitted) {
      w.planDue ??= addBusinessDays(intake.submitted.slice(0, 10), 3);
      enqueue(
        x.id,
        "answers",
        "Your Onboarding Answers Have Been Received",
        `Your coach is preparing your personalised plan. Expected ready date: ${w.planDue}. A walkthrough invitation follows once the plan is ready.`,
      );
    }
    if (w.planReady && w.slots?.length)
      enqueue(
        x.id,
        "slots",
        "Your Plan Is Ready — Book Your Walkthrough",
        "Your plan is ready for discussion, not attached to this email. Choose one of the four coach-offered slots in Walkthrough Booking. The walkthrough lasts 30 minutes.",
      );
    if (w.slots?.length && !w.booking)
      enqueue(
        x.id,
        "slot-reminder",
        "Reminder — Choose Your Walkthrough Slot",
        "Please choose one available walkthrough slot. Slots are rechecked when you book.",
        dateAdd(w.slotsAt || day, 2),
      );
    if (w.booking)
      enqueue(
        x.id,
        "booking",
        "Your Walkthrough Is Booked",
        `Your 30-minute walkthrough is booked for ${w.booking.date} at ${w.booking.time} UTC. We will discuss your plan and commitments.`,
      );
    if (w.walkthroughDone && p.agreed)
      enqueue(
        x.id,
        "balance",
        "Confirm Your Start — Remaining Payment",
        "Your walkthrough and plan agreement are recorded. Remaining balance: $350. After verified payment, your programme begins the following day. Payment destination, currency and final invoice details require coach review.",
      );
    if (p.balance) {
      w.balanceDate ??= day;
      const start = dateAdd(w.balanceDate, 1);
      if (
        w.walkthroughDone &&
        p.deposit &&
        p.agreed &&
        intake?.submitted &&
        p.status === "Not Activated"
      ) {
        const proposal = { ...p, status: "Active", start };
        state.programmes[x.id] = proposal;
        if (callConflict(x.id)) {
          state.programmes[x.id] = p;
          w.activationIssue =
            "Call conflict: select another recurring time in Calendar.";
        } else {
          w.autoActivated = true;
          delete w.activationIssue;
        }
      }
      enqueue(
        x.id,
        "paid",
        "Balance Confirmed — Your Programme Starts Tomorrow",
        `Payment confirmation: balance $350; total received $500. Programme start: ${start}, UTC. The production account setup link will let you set your own password; no password is emailed.`,
      );
      enqueue(
        x.id,
        "welcome",
        "Welcome — Your Programme Starts Today",
        `Your start date is ${start}. Visit My Day, My Habits, Daily Practices, Check-Ins, Journals and My Resources. Production login and private links are not connected.`,
        start,
      );
    }
  }
}
function reconcileMessages() {
  for (const e of Object.values(state.outbox || {})) {
    const w = workflow(e.client),
      p = programme(e.client);
    if (["Sent", "Failed"].includes(e.status)) continue;
    if (
      (e.type === "questionnaire-reminder" &&
        state.intakes[e.client]?.submitted) ||
      (e.type === "slot-reminder" && w.booking)
    ) {
      e.status = "Cancelled";
      continue;
    }
    if (
      ["On Hold", "Ended"].includes(p.status) &&
      e.due >= day &&
      ["welcome", "slot-reminder", "questionnaire-reminder"].includes(e.type)
    ) {
      e.status = p.status === "Ended" ? "Cancelled" : "Paused";
    } else if (e.status === "Paused") e.status = "Draft";
  }
}
function taskList() {
  const tasks = [];
  for (const x of clients) {
    if (x.isTest) continue;
    const id = x.id,
      w = workflow(id),
      p = programme(id),
      intake = state.intakes[id],
      l = state.leads.find((l) => l.id === id);
    const add = (kind, label, due, view, waiting = false) =>
      tasks.push({
        id: id + ":" + kind,
        client: id,
        label,
        due,
        view,
        waiting,
      });
    if (l && !w.firstStepsReviewed)
      add(
        "first",
        "Review First Steps & Agreement",
        l.created.slice(0, 10),
        "emails",
      );
    if (!p.deposit) {
      if (l) add("deposit", "Waiting For $150 Deposit", day, "leads", true);
      continue;
    }
    if (!intake?.submitted) {
      add(
        "answers",
        "Waiting For Questionnaire",
        dateAdd(w.depositDate || day, 2),
        "onboarding",
        true,
      );
      continue;
    }
    if (!w.planReady) {
      add(
        "plan",
        "Prepare Personalised Plan",
        w.planDue || addBusinessDays(intake.submitted.slice(0, 10), 3),
        "habits",
      );
      continue;
    }
    if (!w.slots?.length) {
      add("slots", "Offer Four Walkthrough Slots", day, "work");
      continue;
    }
    if (!w.booking) {
      add("booking", "Waiting For Slot Selection", day, "work", true);
      continue;
    }
    if (!w.walkthroughDone) {
      add(
        "walkthrough",
        "Complete Walkthrough & Record Changes",
        w.booking.date,
        "work",
      );
      continue;
    }
    if (!p.agreed) {
      add("agreement", "Confirm Plan Agreement", day, "leads");
      continue;
    }
    if (!p.balance) {
      add("balance", "Waiting For $350 Balance", day, "leads", true);
      continue;
    }
    if (p.status === "Not Activated")
      add(
        "activation",
        "Review Start & Activate Programme",
        dateAdd(w.balanceDate || day, 1),
        "calendar",
      );
  }
  for (const e of Object.values(state.outbox || {})) {
    if (["Failed", "Unknown"].includes(e.status))
      tasks.push({
        id: e.id + ":failed",
        client: e.client,
        label:
          (e.status === "Unknown"
            ? "Verify Email Delivery: "
            : "Resolve Failed Email: ") + e.subject,
        due: day,
        view: "emails",
        waiting: false,
      });
  }
  return tasks;
}
function overview() {
  return workPage();
}
function workPage() {
  const tasks = taskList(),
    overdue = tasks.filter((t) => !t.waiting && t.due < day),
    today = tasks.filter((t) => !t.waiting && t.due === day),
    later = tasks.filter((t) => !t.waiting && t.due > day),
    waiting = tasks.filter((t) => t.waiting);
  return (
    title(
      "Today’s Work",
      "Your next actions, deadlines and client follow-through in one place.",
    ) +
    `<div class="stats"><div class="stat"><span>OVERDUE</span><strong>${overdue.length}</strong><span>Needs a revised action</span></div><div class="stat"><span>DUE TODAY</span><strong>${today.length}</strong><span>Clear next steps</span></div><div class="stat"><span>WAITING ON CLIENT</span><strong>${waiting.length}</strong><span>Payments, answers and bookings</span></div><div class="stat"><span>UPCOMING EVENTS</span><strong>${calendarEvents().filter((e) => e.date >= day).length}</strong><span>Calls and work blocks</span></div></div><div class="grid"><section>${taskGroup("Overdue", overdue)}${taskGroup("Due Today", today)}${taskGroup("Upcoming Tasks", later)}<div class="card"><h2>Upcoming Calls & Work Blocks</h2>${
      calendarEvents()
        .filter((e) => e.date >= day)
        .slice(0, 8)
        .map(
          (e) =>
            `<div class="list-item"><strong>${esc(e.label || "Coaching Call")} · ${esc(clients.find((c) => c.id === e.id)?.name)}</strong><div class="small muted">${e.date} · ${e.time} UTC · ${e.nonblocking ? "Deadline" : (e.duration || 20) + " minutes"}</div></div>`,
        )
        .join("") || '<p class="muted">No scheduled events yet.</p>'
    }</div></section><aside>${taskGroup("Waiting On Client", waiting)}<div class="card"><h2>Work & Booking Controls</h2>${selector()}${workflowControls()}<hr><a class="btn subtle" href="/api/export">Download Encrypted Backup</a></div><div class="note">Tasks update from recorded events. Email delivery requires configured sender and approved business terms. Bank verification remains manual; Google Calendar is not connected.</div></aside></div>`
  );
}
function taskGroup(title, items) {
  return `<div class="card"><h2>${title}</h2>${items.map((t) => `<div class="list-item"><div class="row"><strong>${esc(clients.find((c) => c.id === t.client)?.name)}</strong><span class="badge">${t.due}</span></div><p>${esc(t.label)}</p><button class="btn subtle" data-task-client="${t.client}" data-task-view="${t.view}">Open Next Action</button></div>`).join("") || '<p class="muted small">Nothing here right now.</p>'}</div>`;
}
function workflowControls() {
  if (!c().id) return "<p>No clients yet. Register a lead to begin.</p>";
  const w = workflow(c().id),
    intake = state.intakes[c().id];
  return `<p class="small">Plan deadline: <strong>${w.planDue || "Created after questionnaire submission"}</strong> · Three business days · Weekends excluded</p><form id="plan-deadline-form"><label>Plan Deadline</label><input type="date" name="due" value="${w.planDue || addBusinessDays(day, 3)}" required><button class="btn subtle">Revise Deadline</button></form><form id="work-block-form"><label>Plan Work Block (UTC)</label><input type="date" name="date" value="${w.workBlock?.date || day}" required><input type="time" name="time" value="${w.workBlock?.time || "09:00"}" required><label>Minutes</label><input type="number" name="duration" min="15" max="240" value="${w.workBlock?.duration || 60}" required><button class="btn subtle">Save Work Block</button></form><br><button class="btn primary" data-plan-ready ${!intake?.submitted ? "disabled" : ""}>${w.planReady ? "Plan Ready ✓" : "Mark Plan Ready"}</button><form id="offer-slots-form"><h3>Offer Four Slots</h3>${Array.from({ length: 4 }, (_, i) => `<div class="slot-row"><input type="date" name="date${i}" aria-label="Slot ${i + 1} date" required value="${w.slots?.[i]?.date || dateAdd(day, i + 1)}"><input type="time" name="time${i}" aria-label="Slot ${i + 1} time" required value="${w.slots?.[i]?.time || "14:00"}"></div>`).join("")}<button class="btn subtle" ${!w.planReady ? "disabled" : ""}>Save & Queue Invitation</button></form>${w.booking ? `<div class="note">Walkthrough: ${w.booking.date} · ${w.booking.time} UTC · 30 minutes</div><button class="btn primary" data-walkthrough-done>${w.walkthroughDone ? "Walkthrough Completed ✓" : "Complete Walkthrough"}</button>` : ""}`;
}
function bookingPage() {
  const w = workflow(c().id);
  return (
    title(
      "Walkthrough Booking",
      "Choose one coach-offered slot for a 30-minute discussion. Your plan is not emailed.",
    ) +
    `<div class="card">${w.booking ? `<h2>Booking Confirmed</h2><p>${w.booking.date} · ${w.booking.time} UTC · 30 minutes</p>` : w.slots?.length ? w.slots.map((slot, i) => `<div class="list-item row"><span>${slot.date} · ${slot.time} UTC</span><button class="btn primary" data-book-slot="${i}" ${slotAvailable(c().id, slot.date, slot.time, 30) ? "" : "disabled"}>Choose Slot</button></div>`).join("") : "<p>Your coach will offer four slots when your plan is ready.</p>"}</div>`
  );
}
function calendarEvents() {
  return [
    ...allCalls().map((x) => ({ ...x, label: "Coaching Call", duration: 20 })),
    ...clients.flatMap((x) => {
      const w = workflow(x.id);
      return [
        ...(w.planDue && !w.planReady
          ? [
              {
                id: x.id,
                date: w.planDue,
                time: "23:59",
                duration: 0,
                label: "Plan Deadline",
                nonblocking: true,
              },
            ]
          : []),
        ...(w.workBlock && !w.planReady
          ? [{ ...w.workBlock, id: x.id, label: "Prepare Personalised Plan" }]
          : []),
        ...(w.booking
          ? [
              {
                ...w.booking,
                id: x.id,
                label: "Plan Walkthrough",
                duration: 30,
              },
            ]
          : []),
      ];
    }),
  ].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
function slotAvailable(id, date, time, duration, ignore = "") {
  return !calendarEvents().some(
    (e) =>
      !e.nonblocking &&
      e.date === date &&
      !(e.id === id && e.label === ignore) &&
      minutes(time) < minutes(e.time) + (e.duration || 20) &&
      minutes(time) + duration > minutes(e.time),
  );
}
function bindTasks() {
  $("#plan-deadline-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    workflow(c().id).planDue = new FormData(e.target).get("due");
    save();
    render();
  });
  document.querySelectorAll("[data-task-client]").forEach(
    (b) =>
      (b.onclick = () => {
        state.client = b.dataset.taskClient;
        navigate(b.dataset.taskView);
      }),
  );
  $("#work-block-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      date = f.get("date"),
      time = f.get("time"),
      duration = Number(f.get("duration"));
    if (
      !slotAvailable(c().id, date, time, duration, "Prepare Personalised Plan")
    ) {
      toast("That work block overlaps another event. Choose another slot.");
      return;
    }
    workflow(c().id).workBlock = { date, time, duration };
    save();
    render();
    toast("Plan preparation block added to the internal calendar.");
  });
  $("[data-plan-ready]")?.addEventListener("click", () => {
    if (!state.intakes[c().id]?.submitted) return;
    workflow(c().id).planReady ??= new Date().toISOString();
    save();
    render();
  });
  $("#offer-slots-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!workflow(c().id).planReady) return;
    const f = new FormData(e.target),
      slots = Array.from({ length: 4 }, (_, i) => ({
        date: f.get("date" + i),
        time: f.get("time" + i),
      }));
    if (
      new Set(slots.map((s) => s.date + s.time)).size !== 4 ||
      slots.some(
        (s) =>
          s.date < day ||
          !slotAvailable(c().id, s.date, s.time, 30, "Plan Walkthrough"),
      )
    ) {
      toast("Offer four distinct, available slots dated today or later.");
      return;
    }
    const w = workflow(c().id);
    if (w.booking) {
      toast("A walkthrough is already booked. Preserve the confirmed booking.");
      return;
    }
    w.slots = slots;
    w.slotsAt = day;
    save();
    render();
    toast("Four slots saved. Invitation queued for review.");
  });
  document.querySelectorAll("[data-book-slot]").forEach(
    (b) =>
      (b.onclick = () => {
        const w = workflow(c().id),
          slot = w.slots?.[Number(b.dataset.bookSlot)];
        if (
          w.booking ||
          !slot ||
          slot.date < day ||
          !slotAvailable(c().id, slot.date, slot.time, 30)
        ) {
          toast("This slot is no longer available.");
          return;
        }
        w.booking = { ...slot };
        save();
        render();
        toast("Walkthrough booked in the internal calendar.");
      }),
  );
  $("[data-walkthrough-done]")?.addEventListener("click", () => {
    const w = workflow(c().id);
    if (w.booking) {
      w.walkthroughDone ??= new Date().toISOString();
      save();
      render();
      toast(
        "Walkthrough complete. Confirm plan agreement in Leads & Enrollment.",
      );
    }
  });
  document.querySelectorAll("[data-email-reviewed]").forEach(
    (b) =>
      (b.onclick = () => {
        const e = state.outbox[b.dataset.emailReviewed];
        e.reviewedAt = new Date().toISOString();
        if (e.type === "first") workflow(e.client).firstStepsReviewed = true;
        save();
        render();
        toast("Reviewed. No email was sent.");
      }),
  );
}

function documentControls(id) {
  return `<div class="actions"><a class="btn subtle" href="/api/pdf/agreement?client=${encodeURIComponent(id)}">One-Page Agreement PDF</a><a class="btn subtle" href="/api/pdf/invoice?client=${encodeURIComponent(id)}&stage=deposit">Deposit Invoice</a><a class="btn subtle" href="/api/pdf/receipt?client=${encodeURIComponent(id)}&stage=deposit">Deposit Receipt</a><a class="btn subtle" href="/api/pdf/invoice?client=${encodeURIComponent(id)}&stage=balance">Balance Invoice</a><a class="btn subtle" href="/api/pdf/receipt?client=${encodeURIComponent(id)}&stage=balance">Balance Receipt</a><button class="btn subtle" data-invite-client="${esc(id)}">Create Secure Account Link</button></div>`;
}
function emailsPage() {
  return (
    title(
      "Email Center",
      "Review templates and event-generated messages. Delivery uses the configured verified sender.",
    ) +
    `<div class="card"><h2>Gmail Connection</h2><p>Sender and replies: <strong>seekbyritu@gmail.com</strong></p><p>Connect through Google authorisation. No Gmail password is stored.</p><div class="actions"><button class="btn primary" id="gmail-connect">Connect / Reconnect Gmail</button><button class="btn" id="gmail-disconnect">Disconnect Gmail</button></div><div id="gmail-status"></div></div><div class="note">${window.__config.emailConfigured ? "Email provider configured." : "Email delivery is not configured."} ${window.__config.businessConfigured ? "Business terms configured." : "Final business details and terms are required before sending enrolment emails."} No message is marked Sent without an accepted provider response.</div><div class="card">${
      Object.values(state.outbox || {})
        .map(
          (e) =>
            `<div class="list-item"><div class="row"><h3>${esc(e.subject)}</h3><span class="badge">${esc(e.status)} · ${e.due}</span></div><p class="small muted">${esc(e.recipient || clients.find((c) => c.id === e.client)?.name)} · ${esc(e.id)}</p><p>${esc(e.body)}</p>${e.lastError ? `<div class="note">${esc(e.lastError)}</div>` : ""}<div class="actions"><button class="btn subtle" data-email-reviewed="${esc(e.id)}">Mark Reviewed</button><button class="btn primary" data-send-email="${esc(e.id)}" ${e.due > day || ["Sent", "Cancelled", "Paused", "Unknown"].includes(e.status) ? "disabled" : ""}>${e.status === "Failed" ? "Retry Delivery" : "Send Email"}</button>${e.status === "Unknown" ? `<div class="note">Check Gmail Sent first. The response was interrupted, so retrying without checking could send a duplicate.<div class="actions"><button class="btn subtle" data-resolve-mail="${esc(e.id)}" data-resolution="Sent">I Verified It Was Sent</button><button class="btn subtle" data-resolve-mail="${esc(e.id)}" data-resolution="Draft">Not Sent — Allow Retry</button></div></div>` : ""}</div></div>`,
        )
        .join("") ||
      "<p>No emails queued. Register your first lead to begin.</p>"
    }</div>`
  );
}
function agreement() {
  return (
    title(
      "Service Agreement",
      "Review the exact final terms before accepting or paying. Draft terms are not approved for enrolment.",
    ) +
    (state.mode === "coach" ? selector() : "") +
    `<div class="card"><h2>One Week Of Onboarding + 30 Coaching Days</h2><p>Total: $500 — $150 deposit and $350 programme fee. Currency, refund conditions, cancellation and the proposed 95% eligibility definition require final business approval.</p><a class="btn" href="/api/pdf/agreement?client=${encodeURIComponent(c().id)}">Download Agreement PDF</a><div class="note">${window.__config.businessConfigured ? "Approved terms are configured on the server. Download and review them." : "Final approved terms are not configured. Acceptance and enrolment are blocked."}</div>${state.mode !== "coach" ? '<form id="final-agreement-form"><label>Your Full Name</label><input name="name" required maxlength="150"><label><input type="checkbox" name="accept" required> I have reviewed and agree to the final document.</label><button class="btn primary">Record Account-Authenticated Acknowledgement</button></form>' : ""}<p class="small muted">This records the authenticated account, exact terms version and server timestamp. It is not third-party identity verification or a guarantee of legal enforceability.</p></div>`
  );
}
function bindServerActions() {
  $("#create-test-client")?.addEventListener("click", async () => {
    try {
      await saveChain;
      await api("/api/test-client", {
        method: "POST",
        headers: { "X-CSRF-Token": window.__session.csrf },
      });
      location.reload();
    } catch (e) {
      toast(e.message);
    }
  });
  $("#gmail-connect")?.addEventListener("click", async () => {
    try {
      await saveChain;
      const result = await api("/api/gmail/connect", {
        method: "POST",
        headers: { "X-CSRF-Token": window.__session.csrf },
      });
      location.assign(result.url);
    } catch (e) {
      toast(e.message);
    }
  });
  $("#gmail-disconnect")?.addEventListener("click", async () => {
    try {
      await api("/api/gmail/disconnect", {
        method: "POST",
        headers: { "X-CSRF-Token": window.__session.csrf },
      });
      location.reload();
    } catch (e) {
      toast(e.message);
    }
  });
  document.querySelectorAll("[data-resolve-mail]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await saveChain;
          await api("/api/gmail/resolve-message", {
            method: "POST",
            headers: { "X-CSRF-Token": window.__session.csrf },
            body: JSON.stringify({
              id: b.dataset.resolveMail,
              status: b.dataset.resolution,
            }),
          });
          location.reload();
        } catch (e) {
          toast(e.message);
        }
      }),
  );

  $("#profile-editor")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      lead = state.leads.find((l) => l.id === c().id);
    if (!lead) return;
    for (const k of ["goal", "identity", "difficulty"]) {
      lead[k] = f.get(k);
      c()[k] = f.get(k);
    }
    save();
    render();
    toast("Agreed profile saved.");
  });
  document.querySelectorAll("[data-invite-client]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await saveChain;
          const r = await api("/api/invite", {
            method: "POST",
            headers: { "X-CSRF-Token": window.__session.csrf },
            body: JSON.stringify({ id: b.dataset.inviteClient }),
          });
          const box = document.createElement("div");
          box.className = "note";
          const label = document.createElement("p");
          label.textContent =
            "Private, single-use link valid for 48 hours. Share only with this client. Creating a new link invalidates the previous link.";
          const input = document.createElement("input");
          input.readOnly = true;
          input.value = r.link;
          input.setAttribute("aria-label", "Private invitation link");
          box.append(label, input);
          b.closest(".list-item").append(box);
          input.select();
        } catch (e) {
          toast(e.message);
        }
      }),
  );
  document.querySelectorAll("[data-send-email]").forEach(
    (b) =>
      (b.onclick = async () => {
        b.disabled = true;
        try {
          await saveChain;
          await api("/api/send-email", {
            method: "POST",
            headers: { "X-CSRF-Token": window.__session.csrf },
            body: JSON.stringify({ id: b.dataset.sendEmail }),
          });
          location.reload();
        } catch (e) {
          toast(e.message);
          b.disabled = false;
        }
      }),
  );
  $("#final-agreement-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const f = new FormData(e.target);
      const result = await api("/api/agreement", {
        method: "POST",
        headers: { "X-CSRF-Token": window.__session.csrf },
        body: JSON.stringify({ name: f.get("name"), accept: f.has("accept") }),
      });
      toast(result.message);
    } catch (e) {
      toast(e.message);
    }
  });
}

async function loadGeneratedReports() {
  try {
    const result = await api("/api/reports");
    const el = $("#generated-reports");
    if (!el) return;
    el.innerHTML =
      result.reports
        .filter((r) => r.client === c().id)
        .map(
          (r) =>
            `<p><a class="btn" href="/api/report/${encodeURIComponent(r.id)}">Download Days ${r.endDay === 30 ? "1–30" : Math.max(1, r.endDay - 6) + "–" + r.endDay} PDF</a> <span class="small muted">${r.startDate} — ${r.endDate}</span></p>`,
        )
        .join("") || "Reports appear after completed weeks and Day 30.";
  } catch (e) {
    if ($("#generated-reports"))
      $("#generated-reports").textContent = e.message;
  }
}
async function loadJournalHistory(before) {
  try {
    const result = await api(
      "/api/journal-history?client=" +
        encodeURIComponent(c().id) +
        (before ? "&before=" + encodeURIComponent(before) : ""),
    );
    const el = $("#journal-history");
    if (!el) return;
    el.innerHTML =
      result.entries
        .map(
          (e) =>
            `<details class="list-item"><summary>${esc(e.date)} · ${e.kind === "daily" ? "Daily Journal" : "Learn & Apply"}</summary><p>${esc(e.body)}</p>${e.application ? `<p>Application: ${esc(e.application)}</p>` : ""}${e.outcome ? `<p>Review: ${esc(e.outcome)}</p>` : ""}</details>`,
        )
        .join("") || "No previous entries.";
    if (result.next) {
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = "Older Entries";
      b.onclick = () => loadJournalHistory(result.next);
      el.append(b);
    }
  } catch (e) {
    if ($("#journal-history")) $("#journal-history").textContent = e.message;
  }
}
function profileEditor() {
  const lead = state.leads.find((l) => l.id === c().id) || {};
  return `<form id="profile-editor" class="card"><h2>Edit Agreed Profile</h2>${[
    ["goal", "30-Day Goal"],
    ["identity", "Personal Identity Statement"],
    ["difficulty", "Reported Constraints"],
  ]
    .map(
      ([key, label]) =>
        `<label>${label}</label><textarea name="${key}" required maxlength="5000">${esc(lead[key] || "")}</textarea>`,
    )
    .join("")}<button class="btn primary">Save Agreed Profile</button></form>`;
}
function documentsPage() {
  const files = [
    ["01-Coaching-Agreement-DRAFT.pdf", "One-Page Coaching Agreement"],
    ["02-Deposit-Payment-Request-DRAFT.pdf", "Deposit Payment Request"],
    ["03-Balance-Invoice-DRAFT.pdf", "Balance Invoice"],
    ["04-Payment-Receipt-DRAFT.pdf", "Payment Receipt"],
    [
      "Inner-Code-Agreement-and-Payment-Pack-DRAFT.pdf",
      "Complete Four-Page Pack",
    ],
  ];
  return (
    title(
      "Documents",
      "Branded drafts for review. Client-specific documents are generated from Leads & Enrollment.",
    ) +
    `<div class="card">${files.map(([file, label]) => `<div class="list-item row"><h3>${label}</h3><a class="btn" href="/api/template/${encodeURIComponent(file)}">Download Draft PDF</a></div>`).join("")}</div><div class="note">Do not send or sign until refund, cancellation, scoring, payment and privacy terms are finalised. Plan preparation takes three business days after submitted answers. Saturday and Sunday are excluded; public holidays are not currently excluded.</div>`
  );
}
render();
