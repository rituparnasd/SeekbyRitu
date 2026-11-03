/* Programme entitlements are snapshotted when a client is enrolled. */
(() => {
  const packages = [
    {
      id: "inner-code-self-guided",
      name: "Self-Guided",
      market: "For clients in India",
      price: 50,
      deposit: 0,
      balance: 50,
      days: 30,
      calls: 0,
      interval: 0,
      walkthrough: false,
      planBusinessDays: 5,
      reviewMinutes: 0,
      onboardingDays: 0,
      refundThreshold: null,
      refundBusinessDays: null,
      description:
        "30-day personalised self-mastery programme, independently followed at your own pace. Personalised habits across all five pillars, four daily check-ins, guided practices, journaling prompts and selected resources. No private coaching calls.",
    },
    {
      id: "inner-code-guided",
      name: "Guided Coaching",
      market: "For clients in India",
      price: 100,
      deposit: 0,
      balance: 100,
      days: 30,
      calls: 6,
      interval: 5,
      walkthrough: false,
      planBusinessDays: 5,
      reviewMinutes: 0,
      onboardingDays: 0,
      refundThreshold: null,
      refundBusinessDays: null,
      description:
        "30-day personalised self-mastery programme with habits across all five pillars, four daily check-ins, guided practices, journaling prompts and selected resources, plus six private 20-minute coaching calls on Days 5, 10, 15, 20, 25 and 30, with guidance and progress reviews.",
    },
    {
      id: "inner-code",
      name: "Premium Inner Code",
      market: "For clients in Canada",
      price: 500,
      deposit: 150,
      balance: 350,
      days: 30,
      calls: 10,
      interval: 3,
      walkthrough: true,
      planBusinessDays: 5,
      reviewMinutes: 15,
      onboardingDays: 7,
      refundThreshold: 95,
      refundBusinessDays: 5,
      description:
        "One onboarding week and a personalised plan walkthrough, followed by 30 days of self-mastery coaching across all five pillars. Four daily check-ins, journaling, selected resources and ten private 20-minute calls on Days 3, 6, 9, 12, 15, 18, 21, 24, 27 and 30. CAD 150 refundable deposit is included in the CAD 500 price.",
    },
  ];
  const get = (p) => {
    const id = typeof p === "string" ? p : p?.packageId || "inner-code";
    const found = packages.find((x) => x.id === id);
    if (!found) throw Error("Choose a valid Inner Code package.");
    return typeof p === "object" && p.packageSnapshot
      ? { ...found, ...p.packageSnapshot }
      : found;
  };
  globalThis.innerCodePackages = {
    all: packages,
    get,
    paid: (p) => {
      const c = get(p);
      return c.deposit ? !!p?.deposit && !!p?.balance : !!p?.balance;
    },
    questionnaireReady: (p) => (get(p).deposit ? !!p?.deposit : !!p?.balance),
  };
})();
