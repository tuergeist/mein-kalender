import { Worker, Queue } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { processSyncJob } from "./sync-job";

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return { host: parsed.hostname, port: parseInt(parsed.port || "6379") };
}

const connection = parseRedisUrl(process.env.REDIS_URL || "redis://localhost:6379");

const prisma = new PrismaClient();

const activeSyncs = new Set<string>();

const worker = new Worker(
  "calendar-sync",
  async (job) => {
    const { sourceId, userId } = job.data;

    if (activeSyncs.has(sourceId)) {
      console.log(`[sync] Skipping job ${job.id} — source ${sourceId} already syncing`);
      return;
    }

    activeSyncs.add(sourceId);
    try {
      console.log(`[sync] Processing job ${job.id} for source ${sourceId}`);
      await processSyncJob(prisma, sourceId, userId);
    } finally {
      activeSyncs.delete(sourceId);
    }
  },
  {
    connection,
    concurrency: 5,
  }
);

worker.on("completed", (job) => {
  console.log(`[sync] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[sync] Job ${job?.id} failed:`, err.message);
});

// Schedule repeating sync jobs for all active sources
async function scheduleSyncJobs() {
  const queue = new Queue("calendar-sync", { connection });

  const sources = await prisma.calendarSource.findMany({
    where: { syncStatus: { not: "disabled" } },
    select: { id: true, userId: true, syncInterval: true },
  });

  for (const source of sources) {
    await queue.upsertJobScheduler(
      `sync-${source.id}`,
      { every: source.syncInterval * 1000 },
      {
        name: "sync-source",
        data: { sourceId: source.id, userId: source.userId },
      }
    );
  }

  console.log(`[sync] Scheduled ${sources.length} sync jobs`);
}

scheduleSyncJobs().catch(console.error);

console.log("[sync] Worker started");
