import { test, expect, type Page } from "@playwright/test";

/**
 * Waitlist form (src/components/WaitlistForm.astro). The form POSTs to the hardcoded
 * prod API. Client-side spam friction: a hidden honeypot (name="website") and a
 * MIN_SUBMIT_MS=2000 gate — either one short-circuits to a FAKE success with NO fetch.
 *
 * - honeypot / fast-submit specs assert the success UI shows AND no network call fires
 *   (safe on local + prod — they never hit the API).
 * - happy-path: LOCAL intercepts the API (asserts payload, no real row); PROD does a
 *   real submit with a test-tagged email (per the "full on prod" decision).
 */
const isProd = process.env.E2E_TARGET === "prod";
const WAITLIST_GLOB = "**/api/v1/waitlist";
const SUCCESS = /on the list/i;

async function watchApi(page: Page): Promise<{ hit: () => boolean }> {
  let hit = false;
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/waitlist") && r.method() === "POST") hit = true;
  });
  return { hit: () => hit };
}

test.describe("waitlist form", () => {
  test("honeypot filled → fake success, no API call", async ({ page }) => {
    const api = await watchApi(page);
    await page.goto("/#waitlist", { waitUntil: "domcontentloaded" });
    await page.locator("#waitlist-email").fill("bot@example.com");
    await page.locator("#waitlist-website").fill("http://spam.example"); // honeypot
    await page.waitForTimeout(2200); // past MIN_SUBMIT_MS so only the honeypot is in play
    await page.locator("#waitlist-form button[type=submit]").click();
    await expect(page.locator("#waitlist-status")).toHaveText(SUCCESS);
    await page.waitForTimeout(500);
    expect(api.hit(), "honeypot submission must NOT hit the API").toBe(false);
  });

  test("submit faster than MIN_SUBMIT_MS → fake success, no API call", async ({ page }) => {
    // Local-only: the time-gate is a client-only behavior validated deterministically here via a
    // frozen clock. Against the live prod page the clock-freeze interacts unreliably with the
    // network/render timing, so prod spam-protection is covered by the (timing-independent)
    // honeypot test above instead.
    test.skip(isProd, "time-gate validated on local; honeypot covers prod spam-protection");
    const api = await watchApi(page);
    // Freeze the page clock BEFORE load so the form's renderedAt and the submit-time
    // Date.now() are identical → elapsed 0 < MIN_SUBMIT_MS deterministically (no wall-clock race).
    await page.clock.install();
    await page.goto("/#waitlist", { waitUntil: "domcontentloaded" });
    await page.locator("#waitlist-email").fill("human@example.com");
    await page.locator("#waitlist-form button[type=submit]").click();
    await expect(page.locator("#waitlist-status")).toHaveText(SUCCESS);
    await page.waitForTimeout(500);
    expect(api.hit(), "sub-2s submission must NOT hit the API").toBe(false);
  });

  test("happy path: valid submit after the gate", async ({ page }) => {
    let captured: Record<string, unknown> | null = null;

    if (!isProd) {
      // LOCAL: intercept the prod API so no real waitlist row is created; assert payload.
      await page.route(WAITLIST_GLOB, async (route) => {
        captured = route.request().postDataJSON();
        await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      });
    }

    await page.goto("/#waitlist", { waitUntil: "domcontentloaded" });
    const email = isProd ? `e2e+${Date.now()}@fimil.dev` : "alice@example.com";
    await page.locator("#waitlist-email").fill(email);
    await page.locator("#waitlist-name").fill("E2E Test");
    await page.locator("#waitlist-company").fill("Playwright Co");
    await page.waitForTimeout(2200); // clear the MIN_SUBMIT_MS gate
    await page.locator("#waitlist-form button[type=submit]").click();
    await expect(page.locator("#waitlist-status")).toHaveText(SUCCESS);

    if (!isProd) {
      expect(captured, "API should have been called").not.toBeNull();
      expect(captured).toMatchObject({ email, name: "E2E Test", company: "Playwright Co" });
      expect(captured).not.toHaveProperty("website"); // honeypot stripped
    }
  });
});
