import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { totp, encryption, digest } from "../lib/security.mjs";
import { DatabaseSync } from "node:sqlite";
test("private onboarding never grants CRM login before full verified payment", async () => {
  const dir = await mkdtemp(join(tmpdir(), "seek-private-")),
    origin = "http://127.0.0.1:3194",
    token = randomBytes(32).toString("hex");
  const env = {
    ...process.env,
    NODE_ENV: "test",
    PORT: "3194",
    APP_ORIGIN: origin,
    OWNER_SETUP_TOKEN: token,
    DATA_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    TEST_DB_PATH: join(dir, "db"),
    FINAL_PROGRAMME_TERMS:
      "1. Program\nA personalised coaching programme.\n\n2. Payments\nCAD 150 deposit and CAD 350 balance.",
  };
  delete env.DATABASE_URL;
  const child = spawn(process.execPath, ["server.mjs"], {
    env,
    stdio: ["ignore", "ignore", "inherit"],
  });
  const request = async (path, options = {}) => {
    const r = await fetch(origin + path, {
      method: options.method || "GET",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(options.cookie ? { Cookie: options.cookie } : {}),
        ...(options.csrf ? { "X-CSRF-Token": options.csrf } : {}),
        ...(options.token ? { "X-Onboarding-Token": options.token } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    return {
      status: r.status,
      cookie: r.headers.get("set-cookie")?.split(";")[0],
      data: await r.json(),
    };
  };
  try {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(origin + "/health")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    const setup = await request("/api/setup", {
      method: "POST",
      body: {
        token,
        email: "coach@example.test",
        password: "long-owner-password-123",
      },
    });
    const login = await request("/api/login", {
      method: "POST",
      body: {
        email: "coach@example.test",
        password: "long-owner-password-123",
        code: totp(setup.data.secret),
      },
    });
    const owner = { cookie: login.cookie, csrf: login.data.csrf };
    let snapshot = (await request("/api/state", owner)).data;
    snapshot.state.leads.push({
      id: "new",
      first: "New",
      last: "Client",
      email: "new@example.test",
    });
    snapshot.state.notes.new = "PRIVATE COACH NOTES";
    const save = async () => {
      const r = await request("/api/state", {
        ...owner,
        method: "PUT",
        body: { revision: snapshot.revision, state: snapshot.state },
      });
      assert.equal(r.status, 200);
      snapshot = r.data;
    };
    await save();
    assert.equal(
      (
        await request("/api/invite", {
          ...owner,
          method: "POST",
          body: { id: "new" },
        })
      ).status,
      403,
    );
    const link = await request("/api/onboarding-link", {
      ...owner,
      method: "POST",
      body: { id: "new" },
    });
    const capability = new URL(link.data.link).searchParams.get("onboarding");
    const extra = await request("/api/onboarding-link", {
      ...owner,
      method: "POST",
      body: { id: "new" },
    });
    const expiredToken = new URL(extra.data.link).searchParams.get(
      "onboarding",
    );
    const fixtureDb = new DatabaseSync(join(dir, "db"));
    fixtureDb
      .prepare(
        "UPDATE documents SET payload=? WHERE section='onboarding_links' AND record_key=?",
      )
      .run(
        encryption(env.DATA_ENCRYPTION_KEY).seal({
          client: "new",
          expires: "2000-01-01T00:00:00Z",
        }),
        digest(expiredToken),
      );
    fixtureDb.close();
    assert.equal(
      (await request("/api/onboarding-access", { token: expiredToken })).status,
      404,
    );
    assert.equal(
      (
        await fetch(origin + "/api/onboarding-access", {
          method: "POST",
          headers: {
            Origin: "https://other.example",
            "Content-Type": "application/json",
            "X-Onboarding-Token": capability,
          },
          body: JSON.stringify({
            action: "agree",
            name: "Injected",
            accept: true,
          }),
        })
      ).status,
      403,
    );

    assert.equal(
      (await request("/api/onboarding-access", { token: "wrong" })).status,
      404,
    );
    const access = await request("/api/onboarding-access", {
      token: capability,
    });
    assert.equal(access.status, 200);
    assert.equal(access.cookie, undefined);
    assert.equal(access.data.questions.length, 30);
    assert(!JSON.stringify(access.data).includes("PRIVATE COACH NOTES"));
    assert.equal(
      (
        await request("/api/onboarding-access", {
          method: "POST",
          token: capability,
          body: {
            action: "agree",
            accept: true,
            name: "New Client",
            version: "stale-version",
          },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request("/api/onboarding-access", {
          method: "POST",
          token: capability,
          body: {
            action: "agree",
            accept: true,
            name: "New Client",
            version: access.data.version,
          },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request("/api/onboarding-access", {
          method: "POST",
          token: capability,
          body: {
            action: "intake",
            answers: Array(30).fill("Answer"),
            submit: true,
          },
        })
      ).status,
      403,
    );
    snapshot = (await request("/api/state", owner)).data;
    snapshot.state.programmes.new = { deposit: true, balance: false };
    await save();
    assert.equal(
      (
        await request("/api/onboarding-access", {
          method: "POST",
          token: capability,
          body: {
            action: "intake",
            answers: Array(30).fill("Answer"),
            submit: true,
          },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request("/api/onboarding-access", {
          method: "POST",
          token: capability,
          body: {
            action: "intake",
            answers: Array(30).fill("Overwrite"),
            submit: true,
          },
        })
      ).status,
      409,
    );
    assert.equal((await request("/api/state")).status, 401);
    assert.equal(
      (
        await request("/api/invite", {
          ...owner,
          method: "POST",
          body: { id: "new" },
        })
      ).status,
      403,
    );
    snapshot = (await request("/api/state", owner)).data;
    assert(snapshot.state.workflow.new.planDue);
    snapshot.state.programmes.new.balance = true;
    await save();
    const invite = await request("/api/invite", {
      ...owner,
      method: "POST",
      body: { id: "new" },
    });
    assert.equal(invite.status, 200);
    assert.equal(
      (await request("/api/onboarding-access", { token: capability })).status,
      409,
    );
    assert.equal(
      (
        await request("/api/accept-invite", {
          method: "POST",
          body: {
            token: new URL(invite.data.link).searchParams.get("invite"),
            password: "new-client-password-123",
          },
        })
      ).status,
      200,
    );
    const client = await request("/api/login", {
      method: "POST",
      body: { email: "new@example.test", password: "new-client-password-123" },
    });
    assert.equal(client.status, 200);
  } finally {
    child.kill();
    if (child.exitCode === null)
      await new Promise((r) => child.once("exit", r));
    await rm(dir, { recursive: true, force: true });
  }
});
