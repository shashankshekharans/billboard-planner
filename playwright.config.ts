import { defineConfig, devices } from "@playwright/test";

// Smoke tests for the browser app (served by `vite preview`) and for a page built by the CLI.
// Run `npm run build:app && npm run build:example` first (CI does). Map tiles and Leaflet load from the internet.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,   // each test loads live map tiles; fewer at once keeps timings steady
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", testIgnore: /mobile\.spec/, use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "phone", testMatch: /mobile\.spec/, use: { ...devices["iPhone 13"], browserName: "chromium" } }
  ],
  webServer: {
    command: "npm run preview -w @billboard-planner/app",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
