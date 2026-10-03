import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const PORT = 3000;
// A stand-in for the Anthropic API (tests/support/mock-anthropic.ts), started by global-setup.ts.
const MOCK_ANTHROPIC_PORT = 4010; // also in tests/e2e/global-setup.ts

// End-to-end tests for the main farmer workflows. Needs the local Supabase stack (`npm run db:start`).
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        // A field near Patna; tests that need "no permission" override this.
        geolocation: { latitude: 25.61, longitude: 85.14, accuracy: 9 },
        permissions: ["geolocation"],
      },
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    // Reusing a dev server started by hand only works if it has the two AI variables below.
    reuseExistingServer: true,
    env: {
      ...(process.env as Record<string, string>),
      // AI crop-health help talks to the local stand-in, never to the real API, in e2e tests.
      ANTHROPIC_API_KEY: "e2e-test-key",
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${MOCK_ANTHROPIC_PORT}`,
    },
    timeout: 120_000,
  },
});
