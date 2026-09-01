import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

config({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
  quiet: true,
});
if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is required for integration tests.");
const database = new URL(process.env.DATABASE_URL);
// A separate PostgreSQL schema keeps all test users, admin notifications and balances isolated.
database.searchParams.set("schema", "gaming_marketplace_test");
process.env.DATABASE_URL = database.toString();
process.env.NODE_ENV = "test";
process.env.ORDER_JOBS_ENABLED = "false";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
