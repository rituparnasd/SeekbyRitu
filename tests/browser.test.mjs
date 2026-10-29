import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { totp } from "../lib/security.mjs";
test("empty live workspace, authenticated lead creation and responsive layout", async () => {
  const dir = await mkdtemp(join(tmpdir(), "seek-ui-")),
    origin = "http://127.0.0.1:3192",
    token = randomBytes(32).toString("hex");
  const env = {
    ...process.env,
    NODE_ENV: "test",
    PORT: "3192",
    APP_ORIGIN: origin,
    TEST_DB_PATH: join(dir, "app.db"),
    DATA_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    OWNER_SETUP_TOKEN: token,
  };
  delete env.DATABASE_URL;
  const child = spawn(process.execPath, ["server.mjs"], {
    env,
    stdio: "ignore",
  });
  let browser;
  try {
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(origin + "/health")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    const setup = await (
      await fetch(origin + "/api/setup", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email: "owner@example.test",
          password: "browser-owner-long-123",
        }),
      })
    ).json();
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin);
    await page.locator('[name="email"]').fill("owner@example.test");
    await page.locator('[name="password"]').fill("browser-owner-long-123");
    await page.locator('[name="code"]').fill(totp(setup.secret));
    let loginRequests = 0;
    await page.route("**/api/login", async (route) => {
      loginRequests++;
      await new Promise((r) => setTimeout(r, 100));
      await route.continue();
    });
    await page.locator("#login-form").evaluate((form) => {
      form.requestSubmit();
      form.requestSubmit();
    });
    await page
      .getByRole("heading", { name: "Today’s Work", exact: true })
      .waitFor();
    assert.equal(loginRequests, 1);
    assert.equal(await page.locator("#persona option").count(), 1);
    assert.equal(
      await page.getByText("Daniel Brooks", { exact: true }).count(),
      0,
    );
    await page.locator('[data-view="documents"]').first().click();
    assert.equal(await page.locator('a[href^="/api/template/"]').count(), 5);
    await page.locator('[data-view="leads"]').first().click();
    for (const [n, v] of Object.entries({
      first: "Temporary",
      last: "Fixture",
      email: "client@example.test",
      phone: "555",
    }))
      await page.locator("#lead-" + n).fill(v);
    await page.locator("#lead-form button").click();
    await page
      .getByRole("heading", { name: "Temporary Fixture", exact: true })
      .waitFor();
    await page.evaluate(() => saveChain);
    assert.match(await page.locator("#save-status").textContent(), /Saved/);
    await page.reload();
    await page.locator('[data-view="clients"]').first().click();
    await page
      .locator(".person strong")
      .filter({ hasText: "Temporary Fixture" })
      .waitFor();
    for (const width of [375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert((await page.locator(".sidebar").boundingBox()).height < 110);
    }
    assert.deepEqual(errors, []);
    await page.locator("#logout").click();
    await page.getByRole("heading", { name: "Welcome Back" }).waitFor();
    await page.unroute("**/api/login");
    await page.route("**/api/login", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        headers: { "Retry-After": "1" },
        body: JSON.stringify({
          error: "Too many incorrect attempts",
          retryAfter: 1,
        }),
      }),
    );
    await page.locator('[name="email"]').fill("owner@example.test");
    await page.locator('[name="password"]').fill("browser-owner-long-123");
    await page.locator("#login-form button").click();
    await page.getByRole("button", { name: "Try Again In 0:01" }).waitFor();
    assert.equal(await page.locator("#login-form button").isDisabled(), true);
    await page.getByRole("button", { name: "Sign In", exact: true }).waitFor();
    assert.equal(await page.locator("#login-form button").isDisabled(), false);
  } finally {
    await browser?.close();
    if (child.exitCode === null) {
      child.kill();
      await new Promise((r) => child.once("exit", r));
    }
    await rm(dir, { recursive: true, force: true });
  }
});
