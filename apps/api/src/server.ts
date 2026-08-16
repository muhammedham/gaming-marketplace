import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = buildApp();

async function start() {
  try {
    await app.listen({ host: "127.0.0.1", port: env.API_PORT });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

async function shutdown() {
  await app.close();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

void start();
