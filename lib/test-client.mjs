import { randomUUID } from "node:crypto";
export function addTestClient(
  s,
  today = new Date().toISOString().slice(0, 10),
) {
  const existing = s.leads.find((l) => l.isTest);
  if (existing) return existing;
  const id = randomUUID(),
    start = new Date(today + "T12:00:00Z");
  start.setUTCDate(start.getUTCDate() - 7);
  const startDate = start.toISOString().slice(0, 10);
  const lead = {
    id,
    isTest: true,
    first: "Aarav",
    last: "Mehta (Test)",
    email: "seek-training-" + id + "@example.invalid",
    phone: "Not applicable — test profile",
    source: "Coach Training",
    created: new Date().toISOString(),
    goal: "Build consistent daily action across HRCMS. This is fictional training data.",
    identity:
      "I am a person who acts with awareness, keeps clear commitments and receives support with grace.",
    difficulty: "Fictional example: distraction during a chosen work block.",
  };
  s.leads.push(lead);
  s.programmes[id] = {
    status: "Active",
    start: startDate,
    time: "10:00",
    deposit: true,
    balance: true,
    agreed: true,
    calls: [],
    testPayments: true,
  };
  s.workflow[id] = { planReady: today, walkthroughDone: today };
  const items = [
    [
      "Health",
      "Complete agreed movement",
      "20 minutes of comfortable movement",
    ],
    ["Health", "Prepare balanced meals", "Plan and prepare two suitable meals"],
    ["Health", "Follow sleep wind-down", "Complete the agreed evening routine"],
    [
      "Relationships",
      "Listen without distraction",
      "One ten-minute intentional conversation",
    ],
    [
      "Relationships",
      "Make one clear request",
      "Express one respectful specific request",
    ],
    [
      "Relationships",
      "Express sincere appreciation",
      "One specific appreciation shared",
    ],
    [
      "Career",
      "Complete focused work",
      "One 45-minute client-chosen work block",
    ],
    ["Career", "Send chosen outreach", "One suitable tailored outreach action"],
    [
      "Career",
      "Practise a useful skill",
      "20 minutes of chosen skill practice",
    ],
    ["Money", "Record spending", "Record expenses or a zero-spend day"],
    [
      "Money",
      "Review a budget category",
      "Record one informed budget decision",
    ],
    [
      "Money",
      "Check the next obligation",
      "Check one due date and agreed next action",
    ],
    [
      "Spirituality",
      "Read identity affirmations",
      "Read personal statements and choose an aligned action",
    ],
    [
      "Spirituality",
      "Write sincere shukrana",
      "Record one real gratitude and its meaning",
    ],
    [
      "Spirituality",
      "Apply remembrance to conduct",
      "Practise the agreed reflection and one considerate action",
    ],
  ];
  s.customPlans[id] = items.map(([pillar, name, standard]) => [
    pillar,
    name,
    "Fictional training assignment connecting intention with action.",
    standard,
    "Client-chosen block",
    "Use the coach-agreed smaller alternative; report difficulty honestly.",
  ]);
  s.practicePlans[id] = [
    {
      id: "test-affirmation",
      name: "Personal Affirmations",
      instructions: lead.identity,
      windows: ["Morning", "Midday", "Evening", "Bedtime"],
    },
    {
      id: "test-pause",
      name: "Pause & Choose",
      instructions:
        "Notice facts, feelings and assumptions, then choose one responsible next action.",
      windows: ["Morning", "Midday", "Evening", "Bedtime"],
    },
  ];
  s.intakes[id] = {
    answers: Array.from(
      { length: 30 },
      (_, i) =>
        `Fictional training answer ${i + 1}: identify current patterns, choose a realistic action and discuss barriers with the coach.`,
    ),
    submitted: new Date(startDate + "T12:00:00Z").toISOString(),
  };
  s.records[id + ":" + today] = Object.fromEntries(
    items.map((_, i) => [i, i < 8 ? "done" : i === 8 ? "adapted" : "pending"]),
  );
  s.checkins[id + ":" + today + ":Morning"] = {
    at: new Date(today + "T08:00:00Z").toISOString(),
    feeling: "On track",
    note: "Fictional entry: focus on the chosen work block.",
    snapshot: { ...s.records[id + ":" + today] },
    history: [],
  };
  s.journals[id] = {
    daily: {
      body: "Fictional training entry: I appreciated a supportive conversation and followed my chosen routine.",
      at: new Date().toISOString(),
    },
    learn: {
      body: "Fictional learning: separate an observable fact from an assumption.",
      application: "Ask one clear question before reacting.",
      outcome: "Fictional review: the conversation became clearer.",
      at: new Date().toISOString(),
    },
  };
  s.dailyMaterials[id] = Array.from({ length: 30 }, (_, i) => ({
    title: `Day ${i + 1}: Training Reflection`,
    body: "Original fictional exercise: observe one everyday situation, separate facts from interpretation, and choose one values-aligned action.",
    requirement: "Record learning, application and outcome.",
    coachReview: false,
    locked: false,
  }));
  s.materialProgress[id] = Object.fromEntries(
    Array.from({ length: 7 }, (_, i) => [
      i,
      {
        learning: "Fictional learning recorded.",
        application: "One fictional aligned action.",
        review: "Fictional outcome reviewed.",
        submitted: new Date().toISOString(),
        approved: true,
      },
    ]),
  );
  return lead;
}
