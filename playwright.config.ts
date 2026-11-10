import { defineConfig, devices } from "@playwright/test";

try {
  process.loadEnvFile?.();
} catch {
  // Non-fatal if not present
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:3000",
    trace: "off",
    launchOptions: {
      args: ["--no-proxy-server", "--disable-gpu"],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

