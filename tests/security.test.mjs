import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { totp } from "../lib/security.mjs";
const origin = "http://127.0.0.1:3191";
test("server-backed access, MFA, invitations, client isolation, documents and persistence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "seek-security-"));
  const token = randomBytes(32).toString("hex"),
    key = randomBytes(32).toString("base64");
  const env = {
    ...process.env,
    NODE_ENV: "test",
    PORT: "3191",
    APP_ORIGIN: origin,
    TEST_DB_PATH: join(dir, "data.db"),
    DATA_ENCRYPTION_KEY: key,
    OWNER_SETUP_TOKEN: token,
  };
  delete env.DATABASE_URL;
  const child = spawn(process.execPath, ["server.mjs"], {
    env,
    stdio: ["ignore", "ignore", "inherit"],
  });
  try {
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(origin + "/health")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    async function request(path, { method = "GET", body, cookie, csrf } = {}) {
      const r = await fetch(origin + path, {
        method,
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return {
        status: r.status,
        cookie: r.headers.get("set-cookie")?.split(";")[0],
        data: r.headers.get("content-type")?.includes("application/json")
          ? await r.json()
          : Buffer.from(await r.arrayBuffer()),
      };
    }
    assert.equal((await request("/api/state")).status, 401);
    const setup = await request("/api/setup", {
      method: "POST",
      body: {
        token,
        email: "owner@example.test",
        password: "owner-password-long-123",
      },
    });
    assert.equal(setup.status, 201);
    assert.equal(setup.data.recoveryCodes.length, 8);
    assert.equal(
      (
        await fetch(origin + "/api/login", {
          method: "POST",
          headers: {
            Origin: "https://untrusted.example",
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
      403,
    );
    const bad = await request("/api/login", {
      method: "POST",
      body: {
        email: "owner@example.test",
        password: "owner-password-long-123",
        code: "000000",
      },
    });
    assert.equal(bad.status, 401);
    const login = await request("/api/login", {
      method: "POST",
      body: {
        email: "owner@example.test",
        password: "owner-password-long-123",
        code: totp(setup.data.secret),
      },
    });
    assert.equal(login.status, 200);
    const coach = { cookie: login.cookie, csrf: login.data.csrf };
    let data = (await request("/api/state", coach)).data;
    assert.equal(data.state.leads.length, 0);
    assert.equal(
      (
        await request("/api/state", {
          method: "PUT",
          cookie: coach.cookie,
          body: { revision: 0, state: {} },
        })
      ).status,
      403,
    );
    const s = data.state;
    s.leads = [
      {
        id: "client-one",
        first: "Client",
        last: "One",
        email: "one@example.test",
        phone: "555",
      },
      {
        id: "client-two",
        first: "Client",
        last: "Two",
        email: "two@example.test",
        phone: "556",
      },
    ];
    for (const l of s.leads) {
      s.programmes[l.id] = {
        deposit: true,
        balance: true,
        status: "Active",
        start: new Date().toISOString().slice(0, 10),
        time: "10:00",
      };
      s.customPlans[l.id] = [
        ["Health", "Chosen Action", "Why", "Standard", "Block", "Adaptation"],
      ];
      s.dailyMaterials[l.id] = [
        { title: "Current Resource", body: "Available", coachReview: true },
        { title: "SECRET FUTURE TITLE", body: "SECRET FUTURE BODY" },
      ];
    }
    s.notes["client-one"] = "PRIVATE COACH NOTE";
    s.journals["client-two"] = {
      daily: { body: "OTHER CLIENT PRIVATE JOURNAL" },
    };
    let put = await request("/api/state", {
      ...coach,
      method: "PUT",
      body: { revision: data.revision, state: s },
    });
    assert.equal(put.status, 200);
    const stale = await request("/api/state", {
      ...coach,
      method: "PUT",
      body: { revision: data.revision, state: s },
    });
    assert.equal(stale.status, 409);
    const invite = await request("/api/invite", {
      ...coach,
      method: "POST",
      body: { id: "client-one" },
    });
    assert.equal(invite.status, 200);
    const inviteToken = new URL(invite.data.link).searchParams.get("invite");
    assert.equal(
      (
        await request("/api/accept-invite", {
          method: "POST",
          body: { token: inviteToken, password: "client-password-long-123" },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request("/api/accept-invite", {
          method: "POST",
          body: { token: inviteToken, password: "client-password-long-123" },
        })
      ).status,
      400,
    );
    const logged = await request("/api/login", {
      method: "POST",
      body: { email: "one@example.test", password: "client-password-long-123" },
    });
    const client = { cookie: logged.cookie, csrf: logged.data.csrf };
    data = (await request("/api/state", client)).data;
    assert.equal(data.state.leads.length, 1);
    assert.deepEqual(data.state.notes, {});
    assert.equal(JSON.stringify(data).includes("PRIVATE COACH NOTE"), false);
    assert.equal(
      JSON.stringify(data).includes("OTHER CLIENT PRIVATE JOURNAL"),
      false,
    );
    assert.equal(JSON.stringify(data).includes("SECRET FUTURE"), false);
    assert.equal(
      (await request("/api/pdf/receipt?client=client-two", client)).status,
      403,
    );
    assert.equal((await request("/api/export", client)).status, 403);
    assert.equal(
      (
        await request("/api/invite", {
          ...client,
          method: "POST",
          body: { id: "client-two" },
        })
      ).status,
      403,
    );
    data.state.notes["client-one"] = "INJECTED";
    data.state.journals["client-two"] = { daily: { body: "INJECTED" } };
    data.state.materialProgress["client-one"] = {
      0: {
        learning: "Learned",
        application: "Applied",
        review: "Reviewed",
        approved: true,
      },
    };
    put = await request("/api/state", {
      ...client,
      method: "PUT",
      body: { revision: data.revision, state: data.state },
    });
    assert.equal(put.status, 200);
    const actual = (await request("/api/state", coach)).data.state;
    assert.equal(actual.notes["client-one"], "PRIVATE COACH NOTE");
    assert.equal(
      actual.journals["client-two"].daily.body,
      "OTHER CLIENT PRIVATE JOURNAL",
    );
    assert.equal(actual.materialProgress["client-one"][0].approved, false);
    const pdf = await request("/api/pdf/agreement?client=client-one", coach);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.data.subarray(0, 4).toString(), "%PDF");
    assert.equal(
      (pdf.data.toString("latin1").match(/\/Type \/Page\b/g) || []).length,
      1,
    );
    const backup = await request("/api/export", coach);
    assert.equal(
      JSON.stringify(backup.data).includes("PRIVATE COACH NOTE"),
      false,
    );
    assert.equal(
      (
        await request("/api/send-email", {
          ...coach,
          method: "POST",
          body: { id: "nonexistent" },
        })
      ).status,
      404,
    );
    const raw = await readFile(join(dir, "data.db"));
    assert.equal(
      raw.includes(Buffer.from("OTHER CLIENT PRIVATE JOURNAL")),
      false,
    );
    const me = await request("/api/me", client);
    assert.equal(me.data.role, "client");
    await request("/api/logout", { ...client, method: "POST" });
    assert.equal((await request("/api/state", client)).status, 401);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((r) => child.once("exit", r));
    }
    await rm(dir, { recursive: true, force: true });
  }
});
