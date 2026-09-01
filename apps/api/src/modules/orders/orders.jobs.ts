import { Queue, Worker } from "bullmq";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { autoConfirm } from "./orders.service.js";

export function jobConnection() {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    db: Number(url.pathname.slice(1) || 0),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

export function startOrderJobs(options: {
  queueName?: string;
  intervalMs?: number;
  orderIds?: string[];
  onError: (error: Error) => void;
}) {
  const name = options.queueName ?? "order-auto-confirm";
  const queue = new Queue<{ orderId: string }>(name, {
    connection: { ...jobConnection(), maxRetriesPerRequest: 1 },
  });
  const worker = new Worker<{ orderId: string }>(
    name,
    async (job) => autoConfirm(job.data.orderId),
    {
      connection: { ...jobConnection(), maxRetriesPerRequest: null },
      concurrency: 4,
    },
  );
  queue.on("error", options.onError);
  worker.on("error", options.onError);
  worker.on("failed", (_job, error) => options.onError(error));

  async function schedule(order: { id: string; autoConfirmAt: Date | null }) {
    if (!order.autoConfirmAt) return;
    const jobId = `order-${order.id}-${order.autoConfirmAt.getTime()}`;
    const existing = await queue.getJob(jobId);
    if (existing && (await existing.getState()) === "failed") {
      await existing.retry();
      return;
    }
    await queue.add(
      "confirm",
      { orderId: order.id },
      {
        jobId,
        delay: Math.max(0, order.autoConfirmAt.getTime() - Date.now()),
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true,
        removeOnFail: { count: 1000 },
      },
    );
  }

  let running: Promise<void> | undefined;
  async function scan() {
    let cursor: string | undefined;
    do {
      const rows = await prisma.order.findMany({
        where: {
          status: "WaitingConfirmation",
          autoConfirmAt: { not: null },
          ...(options.orderIds ? { id: { in: options.orderIds } } : {}),
        },
        select: { id: true, autoConfirmAt: true },
        orderBy: { id: "asc" },
        take: 200,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const order of rows) await schedule(order);
      cursor = rows.length === 200 ? rows[rows.length - 1].id : undefined;
    } while (cursor);
  }
  function reconcile() {
    // PostgreSQL is the durable schedule: recover after API/Redis restarts or a failed enqueue.
    running ??= scan()
      .catch(options.onError)
      .finally(() => {
        running = undefined;
      });
    return running;
  }
  const timer = setInterval(() => {
    void reconcile();
  }, options.intervalMs ?? env.ORDER_JOB_RECONCILE_MS);
  timer.unref();
  void reconcile();
  return {
    queue,
    schedule,
    reconcile,
    async close() {
      clearInterval(timer);
      await running;
      await worker.close();
      await queue.close();
    },
  };
}
