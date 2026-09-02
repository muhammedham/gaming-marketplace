import { Queue, Worker } from "bullmq";

import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { jobConnection } from "../orders/orders.jobs.js";
import { deleteAnalysisVideo, processAnalysis } from "./inventory-analysis.service.js";

type InventoryJob =
  | { kind: "analyze"; analysisId: string }
  | { kind: "cleanup"; analysisId: string };

export function startInventoryAnalysisJobs(options: {
  queueName?: string;
  intervalMs?: number;
  onError: (error: Error) => void;
}) {
  const name = options.queueName ?? "inventory-analysis";
  const queue = new Queue<InventoryJob>(name, {
    connection: { ...jobConnection(), maxRetriesPerRequest: 1 },
  });
  const worker = new Worker<InventoryJob>(
    name,
    async (job) => {
      if (job.data.kind === "analyze") await processAnalysis(job.data.analysisId);
      else await deleteAnalysisVideo(job.data.analysisId);
    },
    {
      connection: { ...jobConnection(), maxRetriesPerRequest: null },
      concurrency: 3,
    },
  );
  queue.on("error", options.onError);
  worker.on("error", options.onError);
  worker.on("failed", (_job, error) => options.onError(error));

  async function add(jobId: string, name: string, data: InventoryJob, delay = 0) {
    const existing = await queue.getJob(jobId);
    if (existing) {
      if ((await existing.getState()) === "failed") await existing.retry();
      return;
    }
    await queue.add(name, data, {
      jobId,
      delay,
      attempts: data.kind === "cleanup" ? 10 : 1,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: true,
      removeOnFail: { count: 500 },
    });
  }

  async function scan() {
    const [queued, retained] = await Promise.all([
      prisma.inventoryAnalysis.findMany({
        where: { status: { in: ["QUEUED", "PROCESSING"] } },
        select: { id: true },
        orderBy: { createdAt: "asc" },
        take: 200,
      }),
      prisma.inventoryAnalysis.findMany({
        where: { deletedAt: null },
        select: { id: true, deleteAfter: true },
        orderBy: { deleteAfter: "asc" },
        take: 500,
      }),
    ]);
    for (const analysis of queued) {
      await add(`analyze-${analysis.id}`, "analyze", { kind: "analyze", analysisId: analysis.id });
    }
    for (const analysis of retained) {
      await add(
        `cleanup-${analysis.id}`,
        "cleanup",
        { kind: "cleanup", analysisId: analysis.id },
        Math.max(0, analysis.deleteAfter.getTime() - Date.now()),
      );
    }
  }

  let running: Promise<void> | undefined;
  function reconcile() {
    running ??= scan()
      .catch(options.onError)
      .finally(() => { running = undefined; });
    return running;
  }
  const timer = setInterval(() => void reconcile(), options.intervalMs ?? env.INVENTORY_JOB_RECONCILE_MS);
  timer.unref();
  void reconcile();

  return {
    queue,
    reconcile,
    async close() {
      clearInterval(timer);
      await running;
      await worker.close();
      await queue.close();
    },
  };
}
