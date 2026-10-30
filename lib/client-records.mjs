export function habitStatuses(value, count) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Object.assign(Error("Invalid habit record"), { status: 400 });
  const result = {};
  for (const [key, status] of Object.entries(value)) {
    if (
      !/^(0|[1-9]\d*)$/.test(key) ||
      Number(key) >= count ||
      !["pending", "done", "adapted", "rest", "missed"].includes(status)
    )
      throw Object.assign(
        Error("Habit record contains an unassigned habit or invalid status"),
        { status: 400 },
      );
    result[key] = status;
  }
  return result;
}
