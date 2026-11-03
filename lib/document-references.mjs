import { randomInt } from "node:crypto";
import "../public/programme-content.js";
const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export function documentReference(packageId, existing = new Set()) {
  const prefix = globalThis.programmeContent.get(packageId)?.prefix || "SBR";
  for (let attempt = 0; attempt < 30; attempt++) {
    const code = Array.from(
      { length: 12 },
      () => letters[randomInt(letters.length)],
    ).join("");
    const value = prefix + "-" + code.slice(0, 6) + "-" + code.slice(6);
    if (!existing.has(value)) return value;
  }
  throw Error("Unable to generate a unique document reference. Please retry.");
}
