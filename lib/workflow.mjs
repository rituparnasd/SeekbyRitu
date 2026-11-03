import "../public/calendar.js";
import "../public/packages.js";
const addDays = (date, n) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export function reconcileWorkflow(s, today = globalThis.coachingTime.today()) {
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
    if (!["Sent", "Unknown", "Pending"].includes(s.outbox[key].status))
      Object.assign(s.outbox[key], { subject, body, due });
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
      cfg = globalThis.innerCodePackages.get(p),
      intake = s.intakes[id];
    const paid = globalThis.innerCodePackages.paid(p),
      questionnaire = globalThis.innerCodePackages.questionnaireReady(p);
    enqueue(
      id,
      "first",
      "Your First Steps — " + cfg.name,
      `Review your Service Agreement and payment request for ${cfg.name}. Total: CAD ${cfg.price}. ${cfg.deposit ? "Pay the CAD 150 deposit first, then CAD 350 after the plan walkthrough." : "Pay the full CAD " + cfg.price + " before account access."} Use your private agreement link. No CRM login is needed yet.`,
    );
    if (cfg.deposit && p.deposit) {
      w.depositDate ??= p.verifiedAt?.deposit
        ? globalThis.coachingTime.dateAt(p.verifiedAt.deposit)
        : today;
      enqueue(
        id,
        "deposit",
        "Deposit Confirmed — Complete Your Onboarding",
        "Your CAD 150 deposit is confirmed. Receipt attached. Complete the questionnaire through your private link. Allow three business days for plan preparation after submission.",
      );
    }
    if (questionnaire && !intake?.submitted)
      enqueue(
        id,
        "questionnaire-reminder",
        "Complete Your Onboarding Questionnaire",
        "Your private questionnaire is pending. Submit it so Rituparna can personalise your plan.",
        addDays(w.depositDate || w.balanceDate || today, 2),
      );
    if (intake?.submitted) {
      w.planDue ??= globalThis.addBusinessDays(
        globalThis.coachingTime.dateAt(
          intake.submitted.length === 10
            ? intake.submitted + "T12:00:00Z"
            : intake.submitted,
        ),
        3,
      );
      enqueue(
        id,
        "answers",
        "Your Onboarding Answers Have Been Received",
        `Your personalised plan preparation deadline is ${w.planDue} (Calgary date). ${cfg.walkthrough ? "Walkthrough times will be offered once your plan is ready." : "Rituparna will confirm when your personalised programme is ready."}`,
      );
    }
    if (cfg.walkthrough && w.planReady && w.slots?.length) {
      enqueue(
        id,
        "slots",
        "Your Plan Is Ready — Choose A Walkthrough Time",
        "Reply with one of the offered times for your separate 30-minute plan walkthrough. Your plan is not attached.",
      );
      if (!w.booking)
        enqueue(
          id,
          "slot-reminder",
          "Reminder — Choose Your Walkthrough Time",
          "Reply to the email with your chosen offered time.",
          addDays(w.slotsAt || today, 2),
        );
    }
    if (cfg.walkthrough && w.booking)
      enqueue(
        id,
        "booking",
        "Your Walkthrough Is Booked",
        `Your 30-minute walkthrough: ${globalThis.coachingTime.display(w.booking)}.`,
      );
    if (cfg.walkthrough && w.walkthroughDone && p.agreed)
      enqueue(
        id,
        "balance",
        "Confirm Your Start — CAD 350 Balance",
        "Your walkthrough and plan approval are recorded. Your CAD 350 balance invoice is attached. After verification, access is scheduled for the following Calgary day.",
      );
    if (paid) {
      w.balanceDate ??= p.verifiedAt?.balance
        ? globalThis.coachingTime.dateAt(p.verifiedAt.balance)
        : today;
      const ready =
        !!intake?.submitted &&
        (cfg.walkthrough ? !!w.walkthroughDone && !!p.agreed : !!w.planReady);
      const readyDate =
        !cfg.walkthrough && typeof w.planReady === "string"
          ? globalThis.coachingTime.dateAt(
              w.planReady.length === 10
                ? w.planReady + "T12:00:00Z"
                : w.planReady,
            )
          : w.balanceDate;
      const start = addDays([w.balanceDate, readyDate].sort().at(-1), 1),
        startText = globalThis.coachingTime.display(
          globalThis.coachingTime.fromLocal(start, "00:00"),
        );
      enqueue(
        id,
        "paid",
        ready
          ? "Payment Confirmed — Your Programme Starts Tomorrow"
          : "Payment Confirmed — Next Steps",
        `Your CAD ${cfg.balance} payment is confirmed. Total received: CAD ${cfg.price}. Receipt attached. ${cfg.walkthrough ? "Your programme opens at " + startText + ". Use your account setup link to set your own password." : "Complete your private questionnaire. Rituparna will personalise your plan and confirm activation."}`,
      );
      if (ready) {
        if (!cfg.walkthrough)
          enqueue(
            id,
            "activation",
            "Your Personalised Programme Is Ready",
            `Your ${cfg.name} programme opens at ${startText}. Use your secure account setup link to set your own password.`,
          );
        enqueue(
          id,
          "welcome",
          "Welcome — Your Programme Starts Today",
          `Your ${cfg.name} programme opens at ${startText}. Sign in for your habits, daily practices, check-ins, journals and resources.`,
          start,
        );
        if ((p.status || "Not Activated") === "Not Activated") {
          const time = p.time || "10:00",
            zone =
              p.timeZone ||
              (p.time ? undefined : globalThis.coachingTime.calgary);
          let calls;
          try {
            calls = globalThis.coachingTime.calls(
              id,
              start,
              p.localTime || time,
              zone,
              cfg.calls,
              cfg.interval,
            );
          } catch (error) {
            w.activationIssue = error.message;
            continue;
          }
          const otherCalls = Object.entries(s.programmes).flatMap(
            ([other, q]) =>
              other !== id && q.status === "Active"
                ? q.calls ||
                  globalThis.coachingTime.calls(
                    other,
                    q.start,
                    q.localTime || q.time || "10:00",
                    q.timeZone,
                    globalThis.innerCodePackages.get(q).calls,
                    globalThis.innerCodePackages.get(q).interval,
                  )
                : [],
          );
          const busy = Object.values(s.workflow).flatMap((ow) => [
            ...(ow.booking ? [{ ...ow.booking, duration: 30 }] : []),
            ...(ow.workBlock && !ow.planReady
              ? [{ ...ow.workBlock, duration: ow.workBlock.duration || 60 }]
              : []),
          ]);
          const conflict = calls.some(
            (call) =>
              otherCalls.some((other) =>
                globalThis.coachingTime.overlaps(call, other, 20, 20),
              ) ||
              busy.some((event) =>
                globalThis.coachingTime.overlaps(
                  call,
                  event,
                  20,
                  event.duration,
                ),
              ),
          );
          if (conflict)
            w.activationIssue =
              "Call conflict: choose another recurring Calgary time in Calendar.";
          else {
            s.programmes[id] = {
              ...p,
              packageId: cfg.id,
              packageSnapshot: p.packageSnapshot || structuredClone(cfg),
              status: "Active",
              start,
              time,
              calls,
              ...(zone
                ? { timeZone: zone, localTime: p.localTime || time }
                : {}),
            };
            w.autoActivated = true;
            delete w.activationIssue;
          }
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
      [
        "welcome",
        "activation",
        "slot-reminder",
        "questionnaire-reminder",
      ].includes(e.type)
    )
      e.status = p.status === "Ended" ? "Cancelled" : "Paused";
    else if (e.status === "Paused") e.status = "Draft";
  }
  return s;
}
