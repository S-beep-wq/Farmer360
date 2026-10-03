import path from "node:path";

import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(import.meta.dirname, "src"),
  // Next.js server-only marker: lets tests import server modules such as the AI service.
  "server-only": path.resolve(import.meta.dirname, "tests/support/empty-module.ts"),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        // Needs the local Supabase stack: `npm run db:start`.
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/integration/setup-env.ts"],
          fileParallelism: false,
          testTimeout: 20000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
