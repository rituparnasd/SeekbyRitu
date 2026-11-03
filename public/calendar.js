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

/* Calendar display and wall-clock conversion shared by browser and server.
 * Existing event date/time pairs remain UTC instants. New recurrences carry a zone.
 */
(() => {
  const calgary = "America/Edmonton",
    india = "Asia/Kolkata";
  const cache = new Map();
  const formatter = (zone) => {
    if (!cache.has(zone))
      cache.set(
        zone,
        new Intl.DateTimeFormat("en-CA", {
          timeZone: zone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        }),
      );
    return cache.get(zone);
  };
  const rawParts = (instant, zone) =>
    Object.fromEntries(
      formatter(zone)
        .formatToParts(instant)
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, p.value]),
    );
  let rules;
  const parts = (instant, zone) => {
    const ms = new Date(instant).getTime();
    if (!rules) return rawParts(instant, zone);
    if (ms < rules.from || ms >= rules.until)
      throw Error("This date is outside the supported scheduling window.");
    const entries = rules.zones[zone];
    if (!entries) throw Error("Unsupported time zone.");
    let offset = entries[0].offset;
    for (const e of entries) {
      if (e.at > ms) break;
      offset = e.offset;
    }
    const d = new Date(ms + offset * 60000),
      pad = (n) => String(n).padStart(2, "0");
    return {
      year: String(d.getUTCFullYear()),
      month: pad(d.getUTCMonth() + 1),
      day: pad(d.getUTCDate()),
      hour: pad(d.getUTCHours()),
      minute: pad(d.getUTCMinutes()),
      second: pad(d.getUTCSeconds()),
    };
  };
  const createRules = (
    first = new Date().getUTCFullYear() - 10,
    last = new Date().getUTCFullYear() + 20,
  ) => {
    const from = Date.UTC(first, 0, 1),
      until = Date.UTC(last + 1, 0, 1),
      zones = {};
    const offset = (ms, z) => {
      const p = rawParts(new Date(ms), z);
      return (
        (Date.UTC(
          +p.year,
          +p.month - 1,
          +p.day,
          +p.hour,
          +p.minute,
          +p.second,
        ) -
          ms) /
        60000
      );
    };
    for (const zone of [calgary, india]) {
      let previous = offset(from, zone);
      const entries = [{ at: from, offset: previous }];
      for (let at = from + 86400000; at < until; at += 86400000) {
        const next = offset(at, zone);
        if (next !== previous) {
          let lo = at - 86400000,
            hi = at;
          while (hi - lo > 60000) {
            const mid = Math.floor((lo + hi) / 120000) * 60000;
            if (offset(mid, zone) === previous) lo = mid;
            else hi = mid;
          }
          entries.push({ at: hi, offset: next });
          previous = next;
        }
      }
      zones[zone] = entries;
    }
    return { from, until, zones };
  };
  const local = (instant, zone = calgary) => {
    const p = parts(instant, zone);
    return {
      date: `${p.year}-${p.month}-${p.day}`,
      time: `${p.hour}:${p.minute}`,
    };
  };
  const utc = (event) => {
    const d = new Date(`${event.date}T${event.time}:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(event.date || "") ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.time || "") ||
      !Number.isFinite(d.getTime()) ||
      d.toISOString().slice(0, 16) !== `${event.date}T${event.time}`
    )
      throw Error("Choose a valid date and time.");
    return d;
  };
  const fromLocal = (date, time, zone = calgary) => {
    const naive = utc({ date, time }).getTime(),
      offsets = new Set();
    for (let h = -36; h <= 36; h += 12) {
      const sample = new Date(naive + h * 3600000),
        p = parts(sample, zone);
      offsets.add(
        Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) -
          sample.getTime(),
      );
    }
    const candidates = [...offsets]
      .map((offset) => new Date(naive - offset))
      .filter((d) => {
        const v = local(d, zone);
        return v.date === date && v.time === time;
      });
    if (candidates.length !== 1)
      throw Error(
        candidates.length
          ? "This Calgary time occurs twice when clocks change. Choose a time outside that repeated hour."
          : "This Calgary time does not exist when clocks change. Choose another time.",
      );
    const d = candidates[0];
    return {
      date: d.toISOString().slice(0, 10),
      time: d.toISOString().slice(11, 16),
    };
  };
  const addDays = (date, n) => {
    const d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const stamp = (instant, zone, label) => {
    const p = parts(instant, zone),
      h = Number(p.hour);
    return `${label}: ${p.day} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(p.month) - 1]} ${p.year}, ${String(h % 12 || 12).padStart(2, "0")}:${p.minute} ${h < 12 ? "am" : "pm"}`;
  };
  const display = (event) => {
    const d = utc(event);
    return `${stamp(d, calgary, "Calgary Time")} | ${stamp(d, india, "India Time")}`;
  };
  const calls = (id, start, time, zone, count = 10, interval = 3) =>
    Array.from({ length: count }, (_, i) => {
      const date = addDays(start, (i + 1) * interval - 1);
      return {
        id,
        number: i + 1,
        programmeDay: (i + 1) * interval,
        ...(zone
          ? {
              ...fromLocal(date, time, zone),
              localDate: date,
              localTime: time,
              timeZone: zone,
            }
          : { date, time }),
      };
    });
  const shiftEvent = (event, days) =>
    event.timeZone
      ? {
          ...event,
          localDate: addDays(
            event.localDate || local(utc(event), event.timeZone).date,
            days,
          ),
          ...fromLocal(
            addDays(
              event.localDate || local(utc(event), event.timeZone).date,
              days,
            ),
            event.localTime || local(utc(event), event.timeZone).time,
            event.timeZone,
          ),
        }
      : { ...event, date: addDays(event.date, days) };
  const overlaps = (a, b, aDuration = 20, bDuration = 20) =>
    utc(a).getTime() < utc(b).getTime() + bDuration * 60000 &&
    utc(b).getTime() < utc(a).getTime() + aDuration * 60000;
  globalThis.coachingTime = {
    createRules,
    configure: (value) => {
      rules = value;
    },
    calgary,
    india,
    utc,
    local,
    fromLocal,
    display,
    calls,
    shiftEvent,
    overlaps,
    dateAt: (instant, zone = calgary) => local(new Date(instant), zone).date,
    today: () => local(new Date(), calgary).date,
  };
})();
