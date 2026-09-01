import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { startOrderJobs } from "./modules/orders/orders.jobs.js";

let jobs: ReturnType<typeof startOrderJobs> | undefined;
const app = buildApp({ wakeOrderJobs: () => { void jobs?.reconcile(); } });

async function start() {
  try {
    await app.listen({ host: "127.0.0.1", port: env.API_PORT });
    if (env.ORDER_JOBS_ENABLED === "true") {
      jobs = startOrderJobs({ onError: (error) => app.log.error(error, "Order confirmation worker") });
    }
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

async function shutdown() {
  await jobs?.close();
  await app.close();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

void start();
