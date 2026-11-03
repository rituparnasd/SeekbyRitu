import "../public/calendar.js";
import "../public/packages.js";
import "../public/payment-links.js";
import "../public/programme-content.js";
const addDays = (date, n) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export function reconcileWorkflow(
  s,
  today = globalThis.coachingTime.today(),
  offers = {},
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
      intake = s.intakes[id],
      full = globalThis.innerCodePackages.fullPayment(p);
    const paid = globalThis.innerCodePackages.paid(p),
      questionnaire = globalThis.innerCodePackages.questionnaireReady(p);
    enqueue(
      id,
      "first",
      "Your First Steps — " + globalThis.programmeContent.get(cfg.id).label,
      `Please review the attached Service Agreement and invoice for ${globalThis.programmeContent.get(cfg.id).label}. ${full ? "Your full payment is CAD 500." : cfg.deposit ? "Your first payment is CAD 150, included in the CAD 500 total." : "Your full payment is CAD " + cfg.price + "."}

Payment Instructions
${globalThis.programmeContent.payment(cfg.id, globalThis.innerCodePackages.firstAmount(p))}

${full ? "1. PAYMENT: Pay CAD 500 in full. A paid-in-full receipt follows verification.\n2. QUESTIONNAIRE: Complete your private questionnaire.\n3. PERSONALISED PLAN: Allow 3–5 business days after submission.\n4. PLAN REVIEW: Review and approve your plan on a 15-minute call. No further balance payment is due.\n5. ACCESS & START: Account access follows plan review and approval. Refund conditions remain in your Service Agreement." : (offers[cfg.id]?.nextSteps ?? globalThis.programmeContent.nextText(cfg.id))}

Review and acknowledge your Service Agreement through your private link. No CRM login is needed yet.`,
    );
    if (cfg.deposit && p.deposit && !full) {
      w.depositDate ??= p.verifiedAt?.deposit
        ? globalThis.coachingTime.dateAt(p.verifiedAt.deposit)
        : today;
      enqueue(
        id,
        "deposit",
        "Deposit Confirmed — Complete Your Onboarding",
        "Your CAD 150 deposit is confirmed. Receipt attached. Complete the questionnaire through your private link. Allow 3–5 business days for plan preparation after submission.",
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
        5,
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
        "Your Plan Is Ready — Choose A Plan Review Time",
        "Reply with one of the offered times for your 15-minute plan-review call. Your plan is not attached.",
      );
      if (!w.booking)
        enqueue(
          id,
          "slot-reminder",
          "Reminder — Choose Your Plan Review Time",
          "Reply to the email with your chosen offered time.",
          addDays(w.slotsAt || today, 2),
        );
    }
    if (cfg.walkthrough && w.booking)
      enqueue(
        id,
        "booking",
        "Your Plan Review Is Booked",
        `Your 15-minute plan review: ${globalThis.coachingTime.display(w.booking)}.`,
      );
    if (cfg.walkthrough && w.walkthroughDone && p.agreed && !full)
      enqueue(
        id,
        "balance",
        "Confirm Your Start — CAD 350 Balance",
        `Your walkthrough and plan approval are recorded. Your CAD 350 balance invoice is attached. Within one business day after payment confirmation, you receive CRM access and your 30-day program begins. ${globalThis.innerCodePayments.instructions(cfg.id, cfg.balance)}`,
      );
    if (paid) {
      w.balanceDate ??= p.verifiedAt?.balance
        ? globalThis.coachingTime.dateAt(p.verifiedAt.balance)
        : today;
      const ready =
        !!intake?.submitted &&
        (cfg.walkthrough
          ? !!w.walkthroughDone && !!p.agreed && (!full || !!w.planReady)
          : !!w.planReady);
      const readyDate =
        !cfg.walkthrough && typeof w.planReady === "string"
          ? globalThis.coachingTime.dateAt(
              w.planReady.length === 10
                ? w.planReady + "T12:00:00Z"
                : w.planReady,
            )
          : full
            ? p.verifiedAt?.agreed
              ? globalThis.coachingTime.dateAt(p.verifiedAt.agreed)
              : typeof w.walkthroughDone === "string"
                ? w.walkthroughDone.slice(0, 10)
                : today
            : w.balanceDate;
      const start =
          p.status && p.status !== "Not Activated" && p.start
            ? p.start
            : globalThis.addBusinessDays(
                [w.balanceDate, readyDate].sort().at(-1),
                1,
              ),
        startText = globalThis.coachingTime.display(
          globalThis.coachingTime.fromLocal(start, "00:00"),
        );
      enqueue(
        id,
        "paid",
        ready
          ? "Payment Confirmed — Your Program Start Date"
          : "Payment Confirmed — Next Steps",
        `Your CAD ${full ? cfg.price : cfg.balance} payment is confirmed. Total received: CAD ${cfg.price}. Receipt attached. ${cfg.walkthrough && !ready ? "Complete your questionnaire, then review and approve your personalised plan before account activation. No further payment is due." : cfg.walkthrough ? "Your programme opens at " + startText + ". Use your account setup link to set your own password." : "Complete your private questionnaire. Rituparna will personalise your plan and confirm activation."}`,
      );
      if (ready) {
        if (!cfg.walkthrough || full)
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
            ...(ow.booking ? [{ ...ow.booking, duration: 15 }] : []),
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
