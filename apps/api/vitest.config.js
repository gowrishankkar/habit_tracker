import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use Node environment (no jsdom)
    environment: "node",

    // Global test helpers — no need to import describe/it/expect in every file
    globals: true,

    // Only run files inside __tests__/ with vitest
    // (streakEngine.test.js uses node:test runner — run it via `test:unit` script)
    include: ["src/__tests__/**/*.test.js"],

    // Longer timeout for integration tests that spin up in-memory MongoDB
    testTimeout: 30_000,
    hookTimeout: 30_000,

    // Separate pools per test file so MongoDB memory server is isolated
    pool: "forks",

    // Coverage
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.js"],
      exclude: ["src/**/*.test.js", "src/server.js"],
    },
  },
});
