import { randomBytes, createHash } from "node:crypto";
export const gmailAddress = "seekbyritu@gmail.com";
export const gmailScope =
  "openid email https://www.googleapis.com/auth/gmail.send";
const safeHeader = (value) => {
  const s = String(value || "");
  if (/[\r\n]/.test(s)) throw Error("Invalid mail header");
  return s;
};
const wrap = (s) => s.match(/.{1,76}/g)?.join("\r\n") || "";
export function gmailRaw(mail, id) {
  const boundary = "seek_" + randomBytes(18).toString("hex");
  const headers = [
    `From: ${safeHeader(mail.from)}`,
    `To: ${mail.to.map(safeHeader).join(", ")}`,
    `Reply-To: ${safeHeader(mail.reply_to || mail.from)}`,
    `Subject: =?UTF-8?B?${Buffer.from(safeHeader(mail.subject)).toString("base64")}?=`,
    `Message-ID: <seek-${createHash("sha256").update(id).digest("hex")}@seekbyritu.com>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];
  let text =
    headers.join("\r\n") +
    "\r\n\r\n" +
    `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap(Buffer.from(mail.text).toString("base64"))}\r\n`;
  for (const a of mail.attachments || []) {
    const filename = safeHeader(a.filename).replace(/["\\]/g, "_");
    text += `--${boundary}\r\nContent-Type: application/pdf; name="${filename}"\r\nContent-Disposition: attachment; filename="${filename}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap(a.content)}\r\n`;
  }
  return Buffer.from(text + `--${boundary}--\r\n`).toString("base64url");
}
export async function sendGmail(mail, id, accessToken, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: gmailRaw(mail, id) }),
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch {
    return {
      status: "Unknown",
      message:
        "Delivery response was interrupted. Check Gmail Sent before retrying to avoid duplicates.",
    };
  }
  if (response.ok) return { status: "Sent" };
  return {
    status: "Failed",
    message: "Gmail rejected the message. Check the connection and retry.",
  };
}
export async function refreshGmail(saved, client, fetcher = fetch) {
  if (saved.accessToken && saved.expires > Date.now() + 60000) return saved;
  if (!saved.refreshToken) throw Error("Reconnect Gmail");
  const response = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.id,
      client_secret: client.secret,
      refresh_token: saved.refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw Error("Gmail authorisation expired. Reconnect Gmail.");
  const t = await response.json();
  return {
    ...saved,
    accessToken: t.access_token,
    expires: Date.now() + (t.expires_in || 3600) * 1000,
  };
}
