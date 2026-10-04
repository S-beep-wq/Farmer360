import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

// Field-readiness: how the app behaves on a low-end phone on a slow network. Runs against the
// PRODUCTION build (run `npm run build` first): `npm run test:perf`.
const PORT = 3100;
const MOCK_PORT = 4011;

export default defineConfig({
  testDir: "tests/perf",
  globalSetup: "./tests/perf/global-setup.ts",
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 7"],
    geolocation: { latitude: 25.61, longitude: 85.14, accuracy: 9 },
    permissions: ["geolocation"],
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ...(process.env as Record<string, string>),
      ANTHROPIC_API_KEY: "perf-test-key",
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
      WEATHER_API_URL: `http://127.0.0.1:${MOCK_PORT}`,
    },
  },
});
