import { defineConfig, devices } from "@playwright/test";

/**
 * fimil.dev marketing-site e2e. Two profiles via E2E_TARGET:
 *   - local (default): build + preview on :4322 (4321 is used by trust-center).
 *   - prod: live https://fimil.dev (no webServer).
 *
 * The waitlist/contact forms POST to the hardcoded prod API (app.fimil.dev). On LOCAL
 * the happy-path specs intercept that request (no real prod rows); on PROD they submit
 * real test-tagged data (per the "full on prod" decision). Honeypot/fast-submit specs
 * never fetch, so they're safe on both.
 */
const isProd = process.env.E2E_TARGET === "prod";
const PORT = 4322;
const baseURL = process.env.E2E_BASE_URL || (isProd ? "https://fimil.dev" : `http://localhost:${PORT}`);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: isProd
    ? undefined
    : {
        command: `npm run build && npm run preview -- --port ${PORT} --host`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
