import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";
import { totp } from "../lib/security.mjs";
test("real client browser: habit, practice, check-in and journal persistence; sequential coach-reviewed resources", async () => {
  const dir = await mkdtemp(join(tmpdir(), "seek-journey-")),
    origin = "http://127.0.0.1:3195",
    token = randomBytes(32).toString("hex");
  const env = {
    ...process.env,
    NODE_ENV: "test",
    PORT: "3195",
    APP_ORIGIN: origin,
    TEST_DB_PATH: join(dir, "db"),
    DATA_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    OWNER_SETUP_TOKEN: token,
  };
  delete env.DATABASE_URL;
  const child = spawn(process.execPath, ["server.mjs"], {
    env,
    stdio: ["ignore", "ignore", "inherit"],
  });
  let browser;
  const req = async (path, options = {}) => {
    const r = await fetch(origin + path, {
      method: options.method || "GET",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(options.cookie ? { Cookie: options.cookie } : {}),
        ...(options.csrf ? { "X-CSRF-Token": options.csrf } : {}),
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
    const setup = await req("/api/setup", {
      method: "POST",
      body: {
        token,
        email: "owner@example.test",
        password: "journey-owner-password-123",
      },
    });
    const login = await req("/api/login", {
      method: "POST",
      body: {
        email: "owner@example.test",
        password: "journey-owner-password-123",
        code: totp(setup.data.secret),
      },
    });
    assert.equal(login.status, 200);
    const owner = { cookie: login.cookie, csrf: login.data.csrf };
    let snap = (await req("/api/state", owner)).data;
    const start = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    snap.state.leads = [
      {
        id: "journey",
        first: "Journey",
        last: "Client",
        email: "journey@example.test",
        goal: "Build consistency",
        identity: "I follow my commitments.",
      },
    ];
    snap.state.programmes.journey = {
      deposit: true,
      balance: true,
      status: "Active",
      start,
      time: "18:00",
    };
    snap.state.customPlans.journey = [
      [
        "Health",
        "Drink water",
        "Why",
        "Two litres",
        "My choice",
        "Agreed adjustment",
      ],
      ["Career", "Read a page", "", "One page", "My choice", ""],
    ];
    snap.state.practicePlans.journey = [
      {
        id: "reflection",
        name: "Pause and reflect",
        instructions: "A short pause.",
        windows: ["Morning"],
      },
    ];
    snap.state.dailyMaterials.journey = [
      {
        title: "First Reading",
        body: "FIRST READING BODY",
        requirement: "Apply and reflect",
        coachReview: true,
        locked: false,
      },
      {
        title: "SECOND SECRET TITLE",
        body: "SECOND SECRET BODY",
        requirement: "Apply and reflect",
        coachReview: false,
        locked: false,
      },
    ];
    snap.state.notes.journey = "COACH PRIVATE CONTENT";
    assert.equal(
      (
        await req("/api/state", {
          ...owner,
          method: "PUT",
          body: { state: snap.state, revision: snap.revision },
        })
      ).status,
      200,
    );
    const invite = await req("/api/invite", {
      ...owner,
      method: "POST",
      body: { id: "journey" },
    });
    assert.equal(
      (
        await req("/api/accept-invite", {
          method: "POST",
          body: {
            token: new URL(invite.data.link).searchParams.get("invite"),
            password: "journey-client-password-123",
          },
        })
      ).status,
      200,
    );
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const openView = async (view) => {
      if (["checkin", "journals", "today"].includes(view))
        await page.locator('.mobile-bottom [data-view="' + view + '"]').click();
      else {
        await page.locator(".mobile-menu-toggle").click();
        await page.locator('.sidebar [data-view="' + view + '"]').click();
      }
    };
    await page.goto(origin);
    await page.locator('[name="email"]').fill("journey@example.test");
    await page.locator('[name="password"]').fill("journey-client-password-123");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await page
      .getByRole("heading", { name: "Your day, with intention.", exact: true })
      .waitFor();
    assert.equal(await page.locator('.sidebar [data-view="admin"]').count(), 0);
    await page.locator(".habit-pillar summary").first().click();
    await page.locator('[data-habit="0"]').check();
    await page.evaluate(() => saveChain);
    await page.reload();
    await page.locator(".habit-pillar summary").first().click();
    assert.equal(await page.locator('[data-habit="0"]').isChecked(), true);
    await page.locator('[data-action="practices"]').click();
    await page.locator('[data-practice="reflection"]').check();
    await page.evaluate(() => saveChain);
    await openView("checkin");
    await page
      .locator('#check-form [name="note"]')
      .fill("Today’s next action.");
    await page.locator('#check-form button[type="submit"]').click();
    await page.evaluate(() => saveChain);
    const snapshot = await page.evaluate(() => api("/api/state"));
    const checkin = Object.values(snapshot.state.checkins)[0];
    assert.equal(checkin.snapshot[0], "done");
    assert.equal(checkin.practiceSnapshot["reflection:Morning"], true);
    await openView("journals");
    await page
      .locator('.journal-form[data-kind="daily"] [name="body"]')
      .fill("Private reflection saved by real client.");
    await page.locator('.journal-form[data-kind="daily"] button').click();
    await page.evaluate(() => saveChain);
    await page.reload();
    await openView("journals");
    assert.equal(
      await page
        .locator('.journal-form[data-kind="daily"] [name="body"]')
        .inputValue(),
      "Private reflection saved by real client.",
    );
    await openView("resources");
    await page.getByText("FIRST READING BODY", { exact: true }).waitFor();
    assert.equal(
      await page.getByText("SECOND SECRET BODY", { exact: true }).count(),
      0,
    );
    for (const field of ["learning", "application", "review"])
      await page
        .locator('.material-form [name="' + field + '"]')
        .fill("Completed " + field);
    await page.locator(".material-form button").click();
    await page.evaluate(() => saveChain);
    const progress = await page.evaluate(() => api("/api/state"));
    assert.equal(progress.state.materialProgress.journey[0].approved, false);
    assert(!JSON.stringify(progress).includes("SECOND SECRET BODY"));
    assert(!JSON.stringify(progress).includes("COACH PRIVATE CONTENT"));
    snap = (await req("/api/state", owner)).data;
    snap.state.materialProgress.journey[0].approved = true;
    assert.equal(
      (
        await req("/api/state", {
          ...owner,
          method: "PUT",
          body: { state: snap.state, revision: snap.revision },
        })
      ).status,
      200,
    );
    await page.reload();
    await openView("resources");
    await page.getByText("SECOND SECRET BODY", { exact: true }).waitFor();
    const coachContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await coachContext.addCookies([
      {
        name: "seek_session",
        value: owner.cookie.split("=")[1],
        url: origin,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    const coachPage = await coachContext.newPage();
    await coachPage.goto(origin);
    await coachPage.locator('.sidebar [data-view="calendar"]').click();
    await coachPage
      .locator(".programme-form")
      .first()
      .evaluate((form) => (form.closest("details").open = true));
    await coachPage.locator('[data-hold="journey"]').click();
    await coachPage.evaluate(() => saveChain);
    assert.equal(
      await coachPage.evaluate(
        () => callsFor("journey").filter((c) => c.date >= day).length,
      ),
      0,
    );
    await page.reload();
    await page
      .getByRole("heading", { name: "Your Programme Is On Hold", exact: true })
      .waitFor();
    assert.equal(await page.locator("[data-habit]").count(), 0);
    await coachPage
      .locator(".programme-form")
      .first()
      .evaluate((form) => (form.closest("details").open = true));
    await coachPage.locator('[data-resume="journey"]').click();
    await coachPage.evaluate(() => saveChain);
    assert(
      (await coachPage.evaluate(
        () => callsFor("journey").filter((c) => c.date >= day).length,
      )) > 0,
    );
    await page.reload();
    await page
      .getByRole("heading", { name: "Your day, with intention.", exact: true })
      .waitFor();
    await coachContext.close();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    child.kill();
    if (child.exitCode === null)
      await new Promise((r) => child.once("exit", r));
    await rm(dir, { recursive: true, force: true });
  }
});
