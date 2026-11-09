import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  expect: { timeout: 30000 },
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "vite --config vite.config.test.ts",
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: "electron/**",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "electron",
      testMatch: "electron/**/*.spec.ts",
      timeout: 300000,
    },
  ],
});
