/* Public Stripe checkout links. Never use these as proof of payment. */
(() => {
  const links = Object.freeze({
    "inner-code-self-guided:50":
      "https://buy.stripe.com/28E7sLdFA44j8I6bRJ43S00",
    "inner-code-guided:100": "https://buy.stripe.com/aFa6oH6d8dET5vUg7Z43S01",
    "inner-code:150": "https://buy.stripe.com/eVq9AT5946cr9MaaNF43S02",
    "inner-code:350": "https://buy.stripe.com/00w00jdFAdETbUi3ld43S03",
  });
  const url = (packageId, amount, currency = "CAD") =>
    currency === "CAD" ? links[packageId + ":" + amount] || "" : "";
  const instructions = (packageId, amount, currency = "CAD") => {
    const link = url(packageId, amount, currency);
    if (currency === "CAD" && globalThis.programmeContent?.get(packageId))
      return globalThis.programmeContent.payment(packageId, Number(amount));
    return link
      ? `Pay CAD ${Number(amount).toFixed(2)} securely via Stripe: ${link}. Use the same email address as your enrollment. Access follows payment verification and program readiness.`
      : "";
  };
  globalThis.innerCodePayments = Object.freeze({ url, instructions, links });
})();
