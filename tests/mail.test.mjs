import test from "node:test";
import assert from "node:assert/strict";
import { gmailRaw, sendGmail, refreshGmail } from "../lib/mail.mjs";
const mail = {
  from: "seekbyritu@gmail.com",
  reply_to: "seekbyritu@gmail.com",
  to: ["client@example.test"],
  subject: "Your receipt",
  text: "Your payment is confirmed.",
  attachments: [
    {
      filename: "receipt.pdf",
      content: Buffer.from("%PDF fixture").toString("base64"),
    },
  ],
};
test("Gmail MIME contains sender, reply address and PDF attachment; header injection rejected", () => {
  const raw = Buffer.from(gmailRaw(mail, "receipt-1"), "base64url").toString();
  assert(raw.includes("From: seekbyritu@gmail.com"));
  assert(raw.includes("Reply-To: seekbyritu@gmail.com"));
  assert(raw.includes("Content-Type: application/pdf"));
  assert(raw.includes('filename="receipt.pdf"'));
  assert.throws(() =>
    gmailRaw({ ...mail, subject: "bad\r\nBcc: other@example.test" }, "id"),
  );
});
test("Gmail accepts provider success, distinguishes explicit rejection from uncertain delivery", async () => {
  let captured;
  const sent = await sendGmail(
    mail,
    "id",
    "test-token",
    async (url, options) => {
      captured = { url, options };
      return { ok: true };
    },
  );
  assert.equal(sent.status, "Sent");
  assert.equal(
    captured.url,
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
  );
  assert.equal(
    (await sendGmail(mail, "id", "test-token", async () => ({ ok: false })))
      .status,
    "Failed",
  );
  assert.equal(
    (
      await sendGmail(mail, "id", "test-token", async () => {
        throw Error("timeout");
      })
    ).status,
    "Unknown",
  );
});
test("Gmail token refresh preserves refresh token and skips refresh for a valid access token", async () => {
  const fresh = await refreshGmail(
    { refreshToken: "private-refresh", expires: 0 },
    { id: "client", secret: "private-secret" },
    async (url, options) => {
      assert.equal(url, "https://oauth2.googleapis.com/token");
      assert.equal(options.body.get("grant_type"), "refresh_token");
      return {
        ok: true,
        json: async () => ({ access_token: "new-access", expires_in: 3600 }),
      };
    },
  );
  assert.equal(fresh.refreshToken, "private-refresh");
  assert.equal(fresh.accessToken, "new-access");
  assert.equal(
    await refreshGmail(fresh, {}, () => {
      throw Error("must not refresh");
    }),
    fresh,
  );
});
