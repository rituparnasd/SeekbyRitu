import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
  createHmac,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export const randomToken = () => randomBytes(32).toString("base64url");
export const digest = (x) => createHash("sha256").update(x).digest("hex");
export function encryption(key) {
  const k = Buffer.from(key || "", "base64");
  if (k.length !== 32)
    throw Error("DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return {
    seal(value) {
      const iv = randomBytes(12),
        c = createCipheriv("aes-256-gcm", k, iv),
        b = Buffer.concat([c.update(JSON.stringify(value)), c.final()]);
      return [iv, c.getAuthTag(), b].map((x) => x.toString("base64")).join(".");
    },
    open(value) {
      const [iv, tag, b] = value
          .split(".")
          .map((x) => Buffer.from(x, "base64")),
        c = createDecipheriv("aes-256-gcm", k, iv);
      c.setAuthTag(tag);
      return JSON.parse(Buffer.concat([c.update(b), c.final()]).toString());
    },
  };
}
export async function hashPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 14 ||
    password.length > 200
  )
    throw Error("Use a password between 14 and 200 characters");
  const salt = randomBytes(16).toString("hex"),
    hash = await scrypt(password, salt, 64, {
      N: 131072,
      r: 8,
      p: 1,
      maxmem: 256 * 1024 * 1024,
    });
  return salt + ":" + hash.toString("hex");
}
export async function checkPassword(password, stored) {
  try {
    const [salt, h] = stored.split(":"),
      hash = await scrypt(String(password).slice(0, 200), salt, 64, {
        N: 131072,
        r: 8,
        p: 1,
        maxmem: 256 * 1024 * 1024,
      }),
      expected = Buffer.from(h, "hex");
    return hash.length === expected.length && timingSafeEqual(hash, expected);
  } catch {
    return false;
  }
}
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function mfaSecret() {
  const bytes = randomBytes(20);
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  return bits
    .match(/.{5}/g)
    .map((x) => alphabet[parseInt(x, 2)])
    .join("");
}
function decode32(value) {
  let bits = "";
  for (const c of value)
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  return Buffer.from(bits.match(/.{8}/g).map((x) => parseInt(x, 2)));
}
export function totp(secret, step = Math.floor(Date.now() / 30000)) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", decode32(secret)).update(b).digest(),
    o = h[19] & 15;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
export function verifyTotp(secret, code, last = -1) {
  if (!/^\d{6}$/.test(String(code))) return false;
  const now = Math.floor(Date.now() / 30000);
  for (const s of [now - 1, now, now + 1])
    if (
      s > last &&
      timingSafeEqual(Buffer.from(totp(secret, s)), Buffer.from(String(code)))
    )
      return s;
  return false;
}
export function constantEqual(a, b) {
  return timingSafeEqual(
    Buffer.from(digest(String(a))),
    Buffer.from(digest(String(b))),
  );
}
