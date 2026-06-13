import { test, expect, type Page } from "@playwright/test";

/**
 * Contact form (src/pages/contact.astro). POSTs to the prod /api/v1/contact. No honeypot/
 * min-time gate here. LOCAL intercepts (asserts payload); PROD submits real test-tagged data.
 * Success path sets #form-status to the `text-low` class; error path uses `text-critical`.
 */
const isProd = process.env.E2E_TARGET === "prod";
const CONTACT_GLOB = "**/api/v1/contact";

async function watchApi(page: Page): Promise<{ hit: () => boolean }> {
  let hit = false;
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/contact") && r.method() === "POST") hit = true;
  });
  return { hit: () => hit };
}

test.describe("contact form", () => {
  test("happy path submits and shows success", async ({ page }) => {
    let captured: Record<string, unknown> | null = null;
    if (!isProd) {
      await page.route(CONTACT_GLOB, async (route) => {
        captured = route.request().postDataJSON();
        await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      });
    }

    await page.goto("/contact", { waitUntil: "domcontentloaded" });
    const email = isProd ? `e2e+${Date.now()}@fimil.dev` : "bob@example.com";
    await page.locator("#name").fill("E2E Test");
    await page.locator("#email").fill(email);
    await page.locator("#company").fill("Playwright Co");
    await page.locator("#inquiry_type").selectOption({ index: 1 });
    await page.locator("#message").fill("Automated e2e contact-form check. Please ignore.");
    await page.locator("#contact-form button[type=submit]").click();

    const status = page.locator("#form-status");
    await expect(status).toBeVisible();
    await expect(status).toHaveClass(/text-low/); // success styling, not text-critical

    if (!isProd) {
      expect(captured, "API should have been called").not.toBeNull();
      expect(captured).toMatchObject({ name: "E2E Test", email, message: /e2e contact-form/i });
    }
  });

  test("missing required fields block submission (no API call)", async ({ page }) => {
    const api = await watchApi(page);
    await page.goto("/contact", { waitUntil: "domcontentloaded" });
    // Leave required name/email/message empty; native HTML5 validation must block submit.
    await page.locator("#contact-form button[type=submit]").click();
    await expect(page.locator("#email")).toHaveJSProperty("validity.valid", false);
    await page.waitForTimeout(300);
    expect(api.hit(), "invalid form must NOT hit the API").toBe(false);
    await expect(page.locator("#form-status")).toBeHidden();
  });
});
