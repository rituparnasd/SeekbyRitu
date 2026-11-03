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
    await page.locator('[data-view="admin"]').click();
    await page.locator("#run-live-check").click();
    await page
      .getByText(
        "Review in Products & Services: Self-Guided, Guided Coaching, Premium Inner Code",
        { exact: false },
      )
      .waitFor();
    let testEmail = null;
    await page.route("**/api/gmail/test", async (route) => {
      if (route.request().method() === "POST")
        testEmail = {
          id: "browser-inbox-reference",
          status: "Sent",
          acceptedAt: new Date().toISOString(),
        };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(testEmail),
      });
    });
    await page.route("**/api/gmail/test-confirm", async (route) => {
      assert.deepEqual(route.request().postDataJSON(), {
        id: "browser-inbox-reference",
        received: true,
      });
      testEmail.confirmedAt = new Date().toISOString();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(testEmail),
      });
    });
    await page
      .getByRole("button", { name: "Test Email Delivery", exact: true })
      .click();
    await page
      .getByText("No inbox test recorded yet.", { exact: true })
      .waitFor();
    await page.locator("#send-inbox-test").click();
    await page.locator("#confirm-inbox-test").waitFor();
    assert.match(
      await page.locator("#inbox-test-status").textContent(),
      /Provider accepted/,
    );
    await page.locator("#confirm-inbox-test").click();
    await page
      .getByText("Receipt confirmed by you.", { exact: true })
      .waitFor();
    await page.unroute("**/api/gmail/test");
    await page.unroute("**/api/gmail/test-confirm");
    await page.locator('[data-view="catalogue"]').click();
    await page.locator("#new-product").click();
    await page.locator("#product-name").fill("Fixture Workshop");
    await page.locator("#product-price").fill("19.99");
    await page.locator("#product-tax").fill("5");
    const description = page.getByRole("textbox", {
      name: "Invoice Description",
      exact: true,
    });
    await description.fill("Personalised workshop\nPractical exercises");
    await page.locator("#product-description").evaluate((field) => {
      const q = documentEditing.get(field);
      q.setSelection(0, q.getLength() - 1);
    });
    const editor = page
      .locator(".document-rich-editor")
      .filter({ has: page.locator("#product-description") });
    await editor
      .getByRole("button", { name: "Bulleted List", exact: true })
      .click();
    await editor.getByRole("button", { name: "Bold", exact: true }).click();
    await editor.getByRole("button", { name: "Italic", exact: true }).click();
    await editor.getByRole("button", { name: "Justify", exact: true }).click();
    const richState = await page
      .locator("#product-description")
      .evaluate((field) =>
        JSON.parse(JSON.stringify(documentEditing.get(field).getContents())),
      );
    assert(richState.ops.some((op) => op.attributes?.bold));
    assert(richState.ops.some((op) => op.attributes?.italic));
    assert(richState.ops.some((op) => op.attributes?.align === "justify"));
    assert(richState.ops.some((op) => op.attributes?.list === "bullet"));
    assert.equal(
      await editor
        .locator(".ql-align-justify")
        .first()
        .evaluate((el) => getComputedStyle(el).textAlign),
      "justify",
    );
    for (const alignment of ["center", "right", "", "justify"]) {
      await editor
        .locator("select.ql-align")
        .selectOption(alignment, { force: true });
      assert.equal(
        await editor
          .locator(".ql-editor li")
          .first()
          .evaluate((el) => getComputedStyle(el).textAlign),
        alignment || "left",
      );
    }
    await editor
      .locator("select.ql-size")
      .selectOption("20pt", { force: true });
    await editor
      .locator("select.ql-font")
      .selectOption("serif", { force: true });
    await editor
      .locator("select.ql-color")
      .selectOption("#175cd3", { force: true });
    await editor
      .locator("select.ql-background")
      .selectOption("#fff3a3", { force: true });
    await editor
      .locator("select.ql-lineheight")
      .selectOption("2", { force: true });
    await editor
      .getByRole("button", { name: "Underline", exact: true })
      .click();
    await editor
      .getByRole("button", { name: "Strikethrough", exact: true })
      .click();
    await editor
      .getByRole("button", { name: "Superscript", exact: true })
      .click();
    const fontState = await page
      .locator("#product-description")
      .evaluate((field) => documentEditing.get(field).getContents());
    for (const [key, value] of Object.entries({
      size: "20pt",
      font: "serif",
      color: "#175cd3",
      background: "#fff3a3",
      underline: true,
      strike: true,
      script: "super",
    }))
      assert(
        fontState.ops.some((op) => op.attributes?.[key] === value),
        `Missing ${key}`,
      );
    assert(fontState.ops.some((op) => op.attributes?.lineheight === "2"));
    await page
      .locator("#product-description")
      .evaluate(
        (field, delta) => documentEditing.get(field).setContents(delta, "user"),
        richState,
      );
    await editor
      .getByRole("button", { name: "Increase Indent", exact: true })
      .click();
    assert(
      await page.locator("#product-description").evaluate((field) =>
        documentEditing
          .get(field)
          .getContents()
          .ops.some((op) => op.attributes?.indent === 1),
      ),
    );
    await editor.getByRole("button", { name: "Undo", exact: true }).click();
    assert.equal(
      await page.locator("#product-description").inputValue(),
      "Personalised workshop\nPractical exercises",
    );
    const terms = page.getByRole("textbox", {
      name: "Default Service Agreement",
      exact: true,
    });
    await terms.fill("Cancellation must be agreed before signing.");
    await page.locator('#product-form [name="approved"]').check();
    await page
      .getByRole("button", { name: "Save Defaults", exact: true })
      .click();
    await page.locator("[data-document-save-error]").waitFor();
    assert.match(
      await page.locator("[data-document-save-error]").textContent(),
      /Cancellation must be agreed before signing/,
    );
    assert.match(
      await terms.innerText(),
      /Cancellation must be agreed before signing/,
    );
    await terms.fill(
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
      .getByRole("textbox", {
        name: "Payment Instructions / Schedule",
        exact: true,
      })
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
    await page
      .getByRole("button", { name: "Record Verified Payment", exact: true })
      .click();
    await page.locator('#billing-receipt-form [name="amount"]').fill("10");
    await page
      .locator('#billing-receipt-form [name="method"]')
      .fill("Fixture transfer");
    await page
      .locator('#billing-receipt-form [name="reference"]')
      .fill("FIXTURE-PAY-1");
    await page.locator('#billing-receipt-form [name="verified"]').check();
    await page
      .getByRole("button", {
        name: "Record Payment & Create Receipt",
        exact: true,
      })
      .click();
    await page
      .getByRole("link", { name: "View Receipt", exact: true })
      .waitFor();
    const billing = await page.evaluate(() => api("/api/billing"));
    assert.equal(billing.payments[0].receipt.amount, 1000);
    const receiptPDF = await page.request.get(
      `${origin}/api/billing/pdf?id=${billing.payments[0].id}&kind=receipt`,
    );
    assert.equal((await receiptPDF.body()).subarray(0, 4).toString(), "%PDF");
    assert.equal(billing.documents[0].total, 2099);
    assert(
      billing.documents[0].items[0].formatting.description.ops.some(
        (op) => op.attributes?.bold,
      ),
    );
    assert(
      billing.documents[0].items[0].formatting.description.ops.some(
        (op) => op.attributes?.italic,
      ),
    );
    assert(
      billing.documents[0].items[0].formatting.description.ops.some(
        (op) => op.attributes?.align === "justify",
      ),
    );
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
    assert.equal(await page.locator(".sidebar .nav button").count(), 6);
    assert.equal(
      await page
        .locator(
          '.sidebar [data-view="documents"],.sidebar [data-view="agreement"]',
        )
        .count(),
      0,
    );
    await page.locator('[data-view="clients"]').first().click();
    await page.getByRole("button", { name: "Add Client", exact: true }).click();
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
    await page.locator('[data-view="admin"]').first().click();
    await page.locator("#create-test-client").click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("#persona option")].some((o) =>
        o.textContent.includes("Aarav"),
      ),
    );
    await page.evaluate(() => {
      state.mode = "coach";
      render();
    });
    const dualZoneText = await page.evaluate(() => {
      state.client = clients.find((c) => c.isTest).id;
      workflow(state.client).booking = { date: "2026-12-10", time: "21:00" };
      state.view = "clienthub";
      render();
      return document.querySelector(".content").textContent;
    });
    assert.match(dualZoneText, /Calgary Time: 10 Dec 2026, 02:00 pm/);
    assert.match(dualZoneText, /India Time: 11 Dec 2026, 02:30 am/);
    await page.evaluate(() => saveChain);
    const foldMessage = await page.evaluate(() => {
      const id = clients.find((c) => c.isTest).id,
        old = structuredClone(state.programmes[id]);
      state.programmes[id] = { ...old, start: "2026-11-01", time: "07:30" };
      delete state.programmes[id].timeZone;
      delete state.programmes[id].localTime;
      state.view = "calendar";
      render();
      const text = document.querySelector(".content").textContent;
      state.programmes[id] = old;
      render();
      return text;
    });
    assert.match(foldMessage, /occurs twice/);
    await page.evaluate(() => saveChain);
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
        "clienthub",
        "admin",
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
      await page.waitForFunction(() => billingData !== null);
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
