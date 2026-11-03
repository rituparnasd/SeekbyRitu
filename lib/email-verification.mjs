import { randomUUID } from "node:crypto";
const reject = (message, status = 409) => {
  throw Object.assign(Error(message), { status });
};
// Store provider acceptance separately from the coach's actual inbox confirmation.
export function emailVerification({
  read,
  write,
  send,
  now = () => new Date(),
}) {
  return {
    read,
    async send() {
      const previous = await read();
      const at = now();
      if (previous?.requestedAt && at - new Date(previous.requestedAt) < 60000)
        reject("Wait one minute before sending another test email.", 429);
      const record = {
        id: randomUUID(),
        requestedAt: at.toISOString(),
        status: "Pending",
      };
      await write(record);
      let delivery;
      try {
        delivery = await send(record);
      } catch {
        delivery = { status: "Unknown" };
      }
      record.status = ["Sent", "Failed", "Unknown"].includes(delivery?.status)
        ? delivery.status
        : "Unknown";
      if (record.status === "Sent") record.acceptedAt = now().toISOString();
      await write(record);
      return record;
    },
    async confirm(id) {
      const record = await read();
      if (
        !record ||
        record.id !== id ||
        !["Sent", "Unknown"].includes(record.status)
      )
        reject(
          "Send a test email and confirm the matching message in your inbox first.",
        );
      record.confirmedAt ??= now().toISOString();
      await write(record);
      return record;
    },
  };
}
