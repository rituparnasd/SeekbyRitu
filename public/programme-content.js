/* Owner-supplied programme content. One brand system; each offer has its own scope. */
(() => {
  const email = "seekbyritu@gmail.com";
  const scope = [
    "This program provides coaching and education.",
    "It does not replace therapy, medical care or other professional advice.",
    "Results depend on your participation and are not guaranteed.",
  ];
  const privacy = [
    "Your questionnaire, check-ins and journals are used to personalize, deliver and administer your program.",
    "Changes to your plan, dates or services require written agreement.",
  ];
  const participation = [
    "Follow your agreed habits, complete four daily check-ins and report honestly.",
    "Missing your habits on **four or more days** without an approved exception ends the program **without a refund**, except where required by law.",
    "Pauses and plan adjustments require written approval.",
  ];
  const acceptance = [
    "Both parties accept these terms by signing.",
    "Your statutory rights remain unaffected.",
  ];
  const indiaPayment = (amount) => [
    `Total: **CAD ${amount}**, payable in full through Stripe.`,
    "No refundable accountability deposit.",
    "After payment confirmation, you receive your questionnaire.",
    "Allow **3–5 business days after submitting your answers** for plan preparation.",
    "CRM access and your program start date will be confirmed when your plan is ready.",
  ];
  const cancellation = [
    "Payments are non-refundable for client cancellation, withdrawal or removal under the participation rules, except where required by law.",
    "This package has no deposit-refund benefit.",
  ];
  const data = {
    "inner-code": {
      label: "Inner Code: Canada",
      prefix: "IC-CA",
      price: 500,
      deposit: 150,
      balance: 350,
      calls: 10,
      reviewMinutes: 15,
      invoiceBullets: [
        "**Onboarding:** one week + personalized plan review.",
        "**Program:** 30 days across Health, Relationships, Career, Money and Spirituality.",
        "**Daily:** four check-ins, habit tracking, journaling and resources.",
        "**Coaching:** ten private 20-minute calls, every third program day.",
      ],
      sections: [
        [
          "Your Program",
          [
            "One onboarding week, a personalized plan and a separate **15-minute plan review**.",
            "Followed by **30 days** of habit tracking across Health, Relationships, Career, Money and Spirituality.",
            "**Four daily check-ins**, journaling and selected resources.",
            "**Ten private 20-minute calls** on Days 3, 6, 9, 12, 15, 18, 21, 24, 27 and 30.",
          ],
        ],
        [
          "Payment and Start",
          [
            "Total: **CAD 500**, paid by e-Transfer to **seekbyritu@gmail.com**.",
            "**CAD 150 upfront; CAD 350 after your plan approval.**",
            "Allow **3–5 business days** after submitting your questionnaire for plan preparation.",
            "Within **one business day** of confirming your CAD 350 payment, you receive CRM access and your 30-day program begins, once onboarding and plan approval are complete.",
            "Your start date will be confirmed in writing.",
          ],
        ],
        ["Participation", participation],
        [
          "Deposit Refund",
          [
            "Your **CAD 150 deposit** is refundable with **at least 95% completion** and no unexcused coaching-call no-shows.",
            "Completion requirements and measurement will be recorded in your personalized plan before you begin.",
            "Eligible deposits are returned within **five business days** after program completion.",
            "Other payments are non-refundable, except where required by law.",
          ],
        ],
        [
          "Calls and Rescheduling",
          [
            "Give at least **24 hours’ notice** to reschedule. Replacement times depend on availability.",
            "You receive three Emergency Cards and two Technical Cards, with a **maximum of three cards usable in total**.",
            "Approved cards allow replacement calls for emergencies or technical problems.",
            "An **unexcused no-show forfeits that call and deposit eligibility**.",
            "If Rituparna cancels, the call is rescheduled without using your cards.",
            "Appointments show Calgary and India times.",
          ],
        ],
        ["Coaching Scope", scope],
        [
          "Privacy and Changes",
          [
            "Your questionnaire, check-ins and journals are used to deliver and administer your program under Seek by Ritu’s Privacy Policy, provided before signing.",
            privacy[1],
          ],
        ],
        ["Acceptance", acceptance],
      ],
    },
    "inner-code-guided": {
      label: "Inner Code: India Guided",
      prefix: "IC-IG",
      price: 100,
      deposit: 0,
      balance: 100,
      calls: 6,
      reviewMinutes: 0,
      invoiceBullets: [
        "**Program:** 30 days across Health, Relationships, Career, Money and Spirituality.",
        "**Plan:** personalized habits and guided practices.",
        "**Daily:** four check-ins, journaling and selected resources.",
        "**Coaching:** six private 20-minute calls, every fifth program day.",
      ],
      sections: [
        [
          "Your Program",
          [
            "A **30-day personalized self-mastery program** across Health, Relationships, Career, Money and Spirituality.",
            "Personalized habits, **four daily check-ins**, guided practices, journaling prompts and selected resources.",
            "**Six private 20-minute calls** on Days 5, 10, 15, 20, 25 and 30.",
            "Guidance and progress reviews during calls.",
            "No separate private plan walkthrough.",
          ],
        ],
        ["Payment and Start", indiaPayment(100)],
        ["Participation", participation],
        [
          "Calls and Rescheduling",
          [
            "Give at least **24 hours’ notice** to request a reschedule.",
            "Replacement times depend on availability.",
            "An unexcused no-show forfeits that call.",
            "Contact Rituparna promptly about emergencies or technical problems.",
            "If Rituparna cancels, a replacement call will be offered.",
            "Appointments show Calgary and India times.",
          ],
        ],
        ["Cancellation and Refunds", cancellation],
        ["Coaching Scope", scope],
        ["Privacy and Changes", privacy],
        ["Acceptance", acceptance],
      ],
    },
    "inner-code-self-guided": {
      label: "Inner Code: India Self-Guided",
      prefix: "IC-IS",
      price: 50,
      deposit: 0,
      balance: 50,
      calls: 0,
      reviewMinutes: 0,
      invoiceBullets: [
        "**Program:** 30 days across Health, Relationships, Career, Money and Spirituality.",
        "**Plan:** personalized habits and guided practices.",
        "**Daily:** four check-ins, journaling and selected resources.",
        "**Format:** independent learning; no private coaching calls.",
      ],
      sections: [
        [
          "Your Program",
          [
            "A **30-day personalized self-mastery program** across Health, Relationships, Career, Money and Spirituality.",
            "Personalized habits, **four daily check-ins**, guided practices, journaling prompts and selected resources.",
            "Follow your plan independently throughout the 30-day program.",
            "**No private coaching calls or private plan walkthrough.**",
          ],
        ],
        ["Payment and Start", indiaPayment(50)],
        ["Participation", participation],
        [
          "Support",
          [
            `Email ${email} for access issues or program questions.`,
            "Private coaching calls and ongoing one-to-one coaching are not included.",
          ],
        ],
        ["Cancellation and Refunds", cancellation],
        [
          "Coaching Scope",
          [
            "This program provides self-mastery education and practices.",
            scope[1],
            scope[2],
          ],
        ],
        ["Privacy and Changes", privacy],
        ["Acceptance", acceptance],
      ],
    },
  };
  const strip = (text) => String(text).replace(/\*\*/g, "");
  const get = (id) => data[id];
  const terms = (id) => {
    const p = get(id);
    if (!p) return "";
    return (
      `INNER CODE SERVICE AGREEMENT\nSeek by Ritu | ${p.label}\n\nProvider: Rituparna Das, operating as BLINDSPOT STUDIOS under Seek by Ritu.\nClient: [Client Name]\nContact: ${email}\n\n` +
      p.sections
        .map(
          ([title, bullets], i) =>
            `${i + 1}. ${title}\n` +
            bullets.map((text) => strip(text)).join("\n"),
        )
        .join("\n\n")
    );
  };
  const delta = (id) => {
    const p = get(id);
    if (!p) return undefined;
    const ops = [
      {
        insert: `INNER CODE SERVICE AGREEMENT\nSeek by Ritu | ${p.label}\n\nProvider: Rituparna Das, operating as BLINDSPOT STUDIOS under Seek by Ritu.\nClient: [Client Name]\nContact: ${email}\n\n`,
      },
    ];
    p.sections.forEach(([title, bullets], index) => {
      ops.push(
        {
          insert: `${index + 1}. ${title}`,
          attributes: {
            bold: true,
            size: "11pt",
            font: "helvetica",
            color: "#103f34",
          },
        },
        { insert: "\n" },
      );
      for (const bullet of bullets) {
        const parts = bullet.split("**");
        parts.forEach((part, i) => {
          if (part)
            ops.push({
              insert: part,
              attributes: {
                font: "helvetica",
                size: "10pt",
                ...(i % 2 ? { bold: true } : {}),
              },
            });
        });
        ops.push({ insert: "\n", attributes: { list: "bullet" } });
      }
      if (index < p.sections.length - 1) ops.push({ insert: "\n" });
    });
    return { ops };
  };
  const payment = (id, amount) => {
    const p = get(id);
    if (!p) return "";
    if (id === "inner-code" && [150, 350, 500].includes(Number(amount)))
      return `Send CAD ${amount} by Interac e-Transfer to ${email}.\nInclude your full name and registration email.${Number(amount) === 150 ? " The deposit is included in the CAD 500 total." : ""}`;
    const url = globalThis.innerCodePayments?.url(id, amount);
    return url
      ? `Pay CAD ${amount} securely through Stripe: ${url}\nUse the same email address as your registration.\nYour bank may apply currency conversion or international payment fees.\nPayment issue? Email ${email}.`
      : "";
  };
  const steps = (id) => {
    const p = get(id);
    if (!p) return [];
    if (p.deposit)
      return [
        [
          "QUESTIONNAIRE",
          "After your CAD 150 payment is confirmed, I create your CRM profile and send your questionnaire.",
        ],
        [
          "PERSONALIZED PLAN",
          "After you submit your answers, allow 3–5 business days for me to prepare your plan, habits, resources and tools in the CRM.",
        ],
        [
          "PLAN REVIEW",
          "I send confirmation when your plan is ready. We can review it on a 15-minute call and make any agreed edits.",
        ],
        [
          "BALANCE PAYMENT",
          "Once you approve the plan, I send a separate invoice for CAD 350.",
        ],
        [
          "ACCESS & START",
          "Within one business day of confirming your CAD 350 payment, you receive CRM access and your 30-day program begins.",
        ],
      ];
    return [
      [
        "PAYMENT",
        `Pay CAD ${p.price} in full through Stripe using the same email address as your registration.`,
      ],
      [
        "QUESTIONNAIRE",
        "After your payment is confirmed, I send your onboarding questionnaire.",
      ],
      [
        "PERSONALIZED PLAN",
        "After you submit your answers, allow 3–5 business days for me to prepare your plan, habits, resources and tools in the CRM.",
      ],
      [
        "ACCESS & START",
        "I confirm when your plan is ready and send your secure account setup link and program start date.",
      ],
      p.calls
        ? [
            "GUIDED COACHING",
            "Your program includes six private 20-minute calls on Days 5, 10, 15, 20, 25 and 30. Appointments display Calgary and India times.",
          ]
        : [
            "SELF-GUIDED PROGRAM",
            "Follow your personalized plan independently for 30 days. Private coaching calls and a private plan walkthrough are not included.",
          ],
    ];
  };
  const description = (id) =>
    get(id)?.invoiceBullets.map(strip).join("\n") || "";
  const descriptionDelta = (id) => ({
    ops: (get(id)?.invoiceBullets || []).flatMap((bullet) => [
      ...bullet
        .split("**")
        .map((text, i) => ({
          insert: text,
          attributes: {
            font: "helvetica",
            size: "10pt",
            ...(i % 2 ? { bold: true } : {}),
          },
        }))
        .filter((op) => op.insert),
      { insert: "\n", attributes: { list: "bullet" } },
    ]),
  });
  const nextText = (id) =>
    !get(id)
      ? ""
      : "What Happens Next\n\n" +
        steps(id)
          .map(([title, body], i) => `${i + 1}. ${title}\n${body}`)
          .join("\n\n");
  globalThis.programmeContent = {
    get,
    terms,
    delta,
    description,
    descriptionDelta,
    payment,
    steps,
    nextText,
    strip,
  };
})();
