import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 10000 },
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:4173/api/health",
    reuseExistingServer: false,
    env: { STORAGE_ROOT: ".landrop/e2e" },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
    {
      name: "firefox",
      testMatch: "sharing.spec.ts",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testMatch: "sharing.spec.ts",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
