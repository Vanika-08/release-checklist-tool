import { defineConfig } from "vitest/config";

// Integration tests run against a real, migrated Postgres. The database is wiped.
export default defineConfig({
  resolve: { alias: { graphql: "graphql/index.js" } },
  test: {
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://postgres:postgres@localhost:5433/releases_test",
    },
    fileParallelism: false,
  },
});
