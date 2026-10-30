import "../public/calendar.js";
const addDays = (date, n) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const minute = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export function reconcileWorkflow(
  s,
  today = new Date().toISOString().slice(0, 10),
) {
  s.workflow ??= {};
  s.outbox ??= {};
  const enqueue = (id, type, subject, body, due = today) => {
    const key = id + ":" + type;
    s.outbox[key] ??= {
      id: key,
      client: id,
      type,
      subject,
      body,
      due,
      status: "Draft",
      created: new Date().toISOString(),
    };
  };
  for (const l of s.leads) {
    if (l.isTest) {
      for (const e of Object.values(s.outbox))
        if (e.client === l.id && e.status !== "Sent") e.status = "Cancelled";
      continue;
    }
    const id = l.id,
      w = (s.workflow[id] ??= {}),
      p = s.programmes[id] || {},
      intake = s.intakes[id];
    enqueue(
      id,
      "first",
      "Your First Steps",
      "Review the attached programme agreement and $150 deposit payment request. Total programme price is $500: $150 deposit and $350 programme fee. Use your private Service Agreement link to review the terms before paying. No CRM login is needed yet.",
    );
    if (p.deposit) {
      w.depositDate ??= (p.verifiedAt?.deposit || today).slice(0, 10);
      enqueue(
        id,
        "deposit",
        "Deposit Confirmed — Complete Your Onboarding",
        "Your $150 deposit is confirmed. Your receipt is attached. Complete the questionnaire through your private onboarding link. After submission, allow three business days (Saturday and Sunday excluded) for plan preparation.",
      );
      if (!intake?.submitted)
        enqueue(
          id,
          "questionnaire-reminder",
          "Reminder — Complete Your Onboarding",
          "Your questionnaire is pending. Please complete it before plan preparation begins.",
          addDays(w.depositDate, 2),
        );
    }
    if (intake?.submitted) {
      w.planDue ??= globalThis.addBusinessDays(
        intake.submitted.slice(0, 10),
        3,
      );
      enqueue(
        id,
        "answers",
        "Your Onboarding Answers Have Been Received",
        `Your plan preparation deadline is ${w.planDue}. Your coach will offer four walkthrough slots once the plan is ready.`,
      );
    }
    if (w.planReady && w.slots?.length) {
      enqueue(
        id,
        "slots",
        "Your Plan Is Ready — Book Your Walkthrough",
        "Your plan is ready. Reply to this email with one of the offered times for a 30-minute walkthrough. Your plan is not attached.",
      );
      if (!w.booking)
        enqueue(
          id,
          "slot-reminder",
          "Reminder — Choose Your Walkthrough Slot",
          "Reply to your coach with your chosen walkthrough time.",
          addDays(w.slotsAt || today, 2),
        );
    }
    if (w.booking)
      enqueue(
        id,
        "booking",
        "Your Walkthrough Is Booked",
        `Your 30-minute walkthrough is booked for ${w.booking.date} at ${w.booking.time} UTC.`,
      );
    if (w.walkthroughDone && p.agreed)
      enqueue(
        id,
        "balance",
        "Confirm Your Start — Remaining Payment",
        "Your walkthrough and agreed plan are recorded. Your $350 balance payment request is attached. After verification, programme access is scheduled for the following day.",
      );
    if (p.balance) {
      w.balanceDate ??= (p.verifiedAt?.balance || today).slice(0, 10);
      const start = addDays(w.balanceDate, 1);
      enqueue(
        id,
        "paid",
        "Balance Confirmed — Your Programme Starts Tomorrow",
        `Your $350 balance is confirmed. Total received: $500. Receipt attached. Your programme starts ${start} UTC. Use your account setup link to set your own password.`,
      );
      enqueue(
        id,
        "welcome",
        "Welcome — Your Programme Starts Today",
        `Your programme starts ${start}. Sign in to My Day for your habits, Daily Practices, Check-Ins, journals and released resources.`,
        start,
      );
      if (
        w.walkthroughDone &&
        p.deposit &&
        p.agreed &&
        intake?.submitted &&
        p.status === "Not Activated"
      ) {
        const time = p.time || "10:00",
          calls = Array.from({ length: 10 }, (_, i) => ({
            id,
            number: i + 1,
            programmeDay: (i + 1) * 3,
            date: addDays(start, (i + 1) * 3 - 1),
            time,
          }));
        const conflict = Object.entries(s.programmes).some(
          ([other, q]) =>
            other !== id &&
            q.status === "Active" &&
            (
              q.calls ||
              Array.from({ length: 10 }, (_, i) => ({
                date: addDays(q.start, (i + 1) * 3 - 1),
                time: q.time || "10:00",
              }))
            ).some((c) =>
              calls.some(
                (x) =>
                  x.date === c.date &&
                  Math.abs(minute(x.time) - minute(c.time)) < 20,
              ),
            ),
        );
        if (conflict)
          w.activationIssue =
            "Call conflict: choose another recurring time in Calendar.";
        else {
          s.programmes[id] = { ...p, status: "Active", start, time, calls };
          w.autoActivated = true;
          delete w.activationIssue;
        }
      }
    }
  }
  for (const e of Object.values(s.outbox)) {
    const w = s.workflow[e.client] || {},
      p = s.programmes[e.client] || {};
    if (["Sent", "Failed"].includes(e.status)) continue;
    if (
      (e.type === "questionnaire-reminder" && s.intakes[e.client]?.submitted) ||
      (e.type === "slot-reminder" && w.booking)
    ) {
      e.status = "Cancelled";
      continue;
    }
    if (
      ["On Hold", "Ended"].includes(p.status) &&
      e.due >= today &&
      ["welcome", "slot-reminder", "questionnaire-reminder"].includes(e.type)
    )
      e.status = p.status === "Ended" ? "Cancelled" : "Paused";
    else if (e.status === "Paused") e.status = "Draft";
  }
  return s;
}
