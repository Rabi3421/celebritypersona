import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser", workers: 1, timeout: 90_000,
  outputDir: ".scratch/playwright-results",
  use: { baseURL: "http://127.0.0.1:3097", browserName: "chromium", channel: "chrome", headless: true },
});
