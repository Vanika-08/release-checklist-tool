import { defineConfig } from "vitest/config";

// Integration tests talk to a real Postgres. Point TEST_DATABASE_URL at a
// throwaway database (migrated with `prisma migrate deploy`); it gets wiped.
export default defineConfig({
  // graphql ships ESM and CJS builds; force one copy so `instanceof GraphQLError`
  // holds inside Yoga's error masking (the classic dual-package hazard).
  resolve: { alias: { graphql: "graphql/index.js" } },
  test: {
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://postgres:postgres@localhost:5432/releases_test",
    },
    fileParallelism: false,
  },
});
