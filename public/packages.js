/* American English is the application copy standard. Never apply this to client answers or signed history. */
globalThis.americanEnglish = (value) =>
  String(value ?? "").replace(
    /\b(programme|programmes|personalise|personalised|personalises|personalising|personalisation|enrolment|enrol|colour|colours|behaviour|authorisation|authorised|counselling|customise|customised|finalise|finalised|finalising|practise|organisation|organisations|organise|organised|centre|centres|recognise|recognised|optimise|summarise|licence|favour|fulfil|cancelled|cancelling|focussed|focussing|modelling|labelled|labelling|travelled|travelling|grey|acknowledgement|acknowledgements|catalogue|catalogues|judgement|judgements|instalment|instalments)\b/gi,
    (word) => {
      const replacement = {
        acknowledgement: "acknowledgment",
        acknowledgements: "acknowledgments",
        judgement: "judgment",
        judgements: "judgments",
        instalment: "installment",
        instalments: "installments",
        catalogue: "catalog",
        catalogues: "catalogs",
        programme: "program",
        programmes: "programs",
        personalise: "personalize",
        personalised: "personalized",
        personalises: "personalizes",
        personalising: "personalizing",
        personalisation: "personalization",
        enrolment: "enrollment",
        enrol: "enroll",
        colour: "color",
        colours: "colors",
        behaviour: "behavior",
        authorisation: "authorization",
        authorised: "authorized",
        counselling: "counseling",
        customise: "customize",
        customised: "customized",
        finalise: "finalize",
        finalised: "finalized",
        finalising: "finalizing",
        practise: "practice",
        organisation: "organization",
        organisations: "organizations",
        organise: "organize",
        organised: "organized",
        centre: "center",
        centres: "centers",
        recognise: "recognize",
        recognised: "recognized",
        optimise: "optimize",
        summarise: "summarize",
        licence: "license",
        favour: "favor",
        fulfil: "fulfill",
        cancelled: "canceled",
        cancelling: "canceling",
        focussed: "focused",
        focussing: "focusing",
        modelling: "modeling",
        labelled: "labeled",
        labelling: "labeling",
        travelled: "traveled",
        travelling: "traveling",
        grey: "gray",
      }[word.toLowerCase()];
      return word === word.toUpperCase()
        ? replacement.toUpperCase()
        : /^[A-Z]/.test(word)
          ? replacement[0].toUpperCase() + replacement.slice(1)
          : replacement;
    },
  );
/* Program entitlements are snapshotted when a client is enrolled. */
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
        "30-day personalized self-mastery program, independently followed at your own pace. Personalized habits across all five pillars, four daily check-ins, guided practices, journaling prompts and selected resources. No private coaching calls.",
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
        "30-day personalized self-mastery program with habits across all five pillars, four daily check-ins, guided practices, journaling prompts and selected resources, plus six private 20-minute coaching calls on Days 5, 10, 15, 20, 25 and 30, with guidance and progress reviews.",
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
        "One onboarding week and a personalized plan walkthrough, followed by 30 days of self-mastery coaching across all five pillars. Four daily check-ins, journaling, selected resources and ten private 20-minute calls on Days 3, 6, 9, 12, 15, 18, 21, 24, 27 and 30. CAD 150 refundable deposit is included in the CAD 500 price.",
    },
  ];
  const get = (p) => {
    const id = typeof p === "string" ? p : p?.packageId || "inner-code";
    const found = packages.find((x) => x.id === id);
    if (!found) throw Error("Choose a valid Inner Code package.");
    const result =
      typeof p === "object" && p.packageSnapshot
        ? { ...found, ...p.packageSnapshot }
        : found;
    return {
      ...result,
      description: globalThis.americanEnglish(result.description),
    };
  };
  globalThis.innerCodePackages = {
    all: packages,
    get,
    fullPayment: (p) =>
      get(p).id === "inner-code" && p?.paymentOption === "full",
    firstAmount: (p) =>
      get(p).id === "inner-code" && p?.paymentOption === "full"
        ? 500
        : get(p).deposit || get(p).price,
    paid: (p) => {
      const c = get(p);
      return c.deposit ? !!p?.deposit && !!p?.balance : !!p?.balance;
    },
    questionnaireReady: (p) => (get(p).deposit ? !!p?.deposit : !!p?.balance),
  };
})();
