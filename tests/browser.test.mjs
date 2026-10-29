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
    await page.locator('[data-view="catalogue"]').click();
    await page.locator("#new-product").click();
    await page.locator("#product-name").fill("Fixture Workshop");
    await page.locator("#product-price").fill("19.99");
    await page.locator("#product-tax").fill("5");
    await page.locator("#product-description").fill("A personalised workshop.");
    await page
      .locator("#product-terms")
      .fill(
        "One workshop. Cancellation accepted up to seven days before the event. Payment is due before attendance.",
      );
    await page.locator('#product-form [name="approved"]').check();
    await page
      .getByRole("button", { name: "Save Defaults", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Fixture Workshop", exact: true })
      .waitFor();
    await page.locator('[data-view="billing"]').click();
    await page.locator("#new-invoice").click();
    const workshopId = await page
      .locator("#item-product-0 option")
      .filter({ hasText: "Fixture Workshop" })
      .getAttribute("value");
    await page.locator("#item-product-0").selectOption(workshopId);
    await page.locator("#billing-name").fill("Invoice Fixture");
    await page.locator("#billing-email").fill("invoice@example.test");
    await page
      .locator("#billing-payment")
      .fill("Pay through the agreed fixture payment method.");
    await page.locator('#invoice-form [name="approved"]').check();
    await page
      .getByRole("button", { name: "Save Draft & Preview", exact: true })
      .click();
    await page
      .getByRole("heading", {
        name: "Draft Invoice · Invoice Fixture",
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("button", { name: "Issue Documents", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Create Revision", exact: true })
      .waitFor();
    const billing = await page.evaluate(() => api("/api/billing"));
    assert.equal(billing.documents[0].total, 2099);
    const invoicePDF = await page.request.get(
      `${origin}/api/billing/pdf?id=${billing.documents[0].id}&kind=invoice`,
    );
    assert.equal((await invoicePDF.body()).subarray(0, 4).toString(), "%PDF");
    await page
      .getByRole("button", { name: "Prepare Email", exact: true })
      .click();
    await page
      .getByText("Live email is disabled for test customers", { exact: true })
      .waitFor();
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
    // Exercise dense forms and long client content at phone and desktop widths.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator("#create-test-client").click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("#persona option")].some((o) =>
        o.textContent.includes("Aarav"),
      ),
    );
    for (const width of [375, 700, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const view of [
        "work",
        "leads",
        "emails",
        "calendar",
        "habits",
        "practices",
        "records",
        "journals",
        "resources",
        "reports",
        "profile",
        "agreement",
        "notes",
        "documents",
        "catalogue",
        "billing",
      ]) {
        await page.evaluate((view) => {
          state.view = view;
          render();
        }, view);
        await page.evaluate(() => document.fonts.ready);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${view} overflows at ${width}px`,
        );
        if (process.env.UI_SCREENSHOTS && [375, 1440].includes(width))
          await page.screenshot({
            path: `${process.env.UI_SCREENSHOTS}/${view}-${width}.png`,
            fullPage: true,
          });
      }
      await page.evaluate(() => {
        state.view = "billing";
        documentEditor = newBillingDraft();
        render();
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `Billing editor overflows at ${width}px`,
      );
      if (process.env.UI_SCREENSHOTS && [375, 1440].includes(width))
        await page.screenshot({
          path: `${process.env.UI_SCREENSHOTS}/billing-editor-${width}.png`,
          fullPage: true,
        });
      await page.evaluate(() => {
        state.mode = "client";
        state.client = clients.find((client) => client.isTest).id;
        state.view = "today";
        render();
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `Client Today overflows at ${width}px`,
      );
      if (process.env.UI_SCREENSHOTS && [375, 1440].includes(width))
        await page.screenshot({
          path: `${process.env.UI_SCREENSHOTS}/today-${width}.png`,
          fullPage: true,
        });
      await page.evaluate(() => {
        state.mode = "coach";
        render();
      });
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
