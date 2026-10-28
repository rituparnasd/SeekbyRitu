/* One rule shared by the browser and server. Holidays are not excluded. */
globalThis.addBusinessDays = function addBusinessDays(date, days = 3) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(days) || days < 0)
    throw new Error("Invalid business-day calculation");
  const value = new Date(date + "T12:00:00Z");
  if (
    !Number.isFinite(value.getTime()) ||
    value.toISOString().slice(0, 10) !== date
  )
    throw new Error("Invalid date");
  while (days > 0) {
    value.setUTCDate(value.getUTCDate() + 1);
    if (![0, 6].includes(value.getUTCDay())) days--;
  }
  return value.toISOString().slice(0, 10);
};
