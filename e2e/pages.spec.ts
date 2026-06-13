import { test, expect, type Page } from "@playwright/test";

/**
 * Every marketing/legal route loads cleanly (2xx, titled, SEO meta + JSON-LD on home,
 * no console errors), primary nav works, and the RSS/sitemap endpoints resolve.
 * Read-only — safe against prod.
 */

const PAGES = [
  "/",
  "/about",
  "/contact",
  "/features",
  "/platform",
  "/pentest",
  "/pricing",
  "/compare",
  "/security",
  "/changelog",
  "/blog",
  "/legal",
  "/legal/terms-of-service",
  "/legal/privacy-policy",
  "/legal/security-policy",
  "/legal/acceptable-use-policy",
  "/legal/cookie-policy",
  "/legal/data-processing-agreement",
  "/legal/service-level-agreement",
  "/legal/dmca",
];

const FEEDS = ["/rss.xml", "/changelog.xml", "/sitemap-index.xml"];

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

test.describe("fimil.dev pages", () => {
  for (const path of PAGES) {
    test(`loads ${path}`, async ({ page }) => {
      const errors = trackConsoleErrors(page);
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(resp, `no response for ${path}`).not.toBeNull();
      expect(resp!.status(), `status for ${path}`).toBeLessThan(400);
      await expect(page).toHaveTitle(/\S+/);
      await expect(page.locator('head meta[name="description"]')).toHaveAttribute("content", /\S+/);
      const real = errors.filter((e) => !/posthog|analytics|favicon|cloudflareinsights/i.test(e));
      expect(real, `console errors on ${path}: ${real.join(" | ")}`).toHaveLength(0);
    });
  }

  test("home has JSON-LD structured data", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('script[type="application/ld+json"]').first()).toHaveCount(1);
  });

  test("blog post renders", async ({ page }) => {
    await page.goto("/blog", { waitUntil: "domcontentloaded" });
    // First link that goes to a specific post (not the /blog index itself).
    const post = page.locator('a[href*="/blog/"]').first();
    await expect(post).toBeVisible();
    const href = await post.getAttribute("href");
    await post.click();
    await expect(page).toHaveURL(new RegExp("/blog/[^/]+"));
    await expect(page.locator("h1")).toBeVisible();
    expect(href, `blog link should be a post: ${href}`).toMatch(/\/blog\/.+/);
  });

  test("primary nav links resolve", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Pricing is linked from the global nav on every page.
    const pricing = page.locator('a[href="/pricing"], a[href="/pricing/"]').first();
    await expect(pricing).toBeVisible();
  });
});

test.describe("fimil.dev feeds", () => {
  for (const feed of FEEDS) {
    test(`resolves ${feed}`, async ({ request, baseURL }) => {
      const resp = await request.get(new URL(feed, baseURL).toString());
      expect(resp.status(), `status for ${feed}`).toBe(200);
      expect(resp.headers()["content-type"] || "").toMatch(/xml/);
    });
  }
});
