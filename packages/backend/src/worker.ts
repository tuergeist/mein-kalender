import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { processSyncJob } from "./sync-job";
import { detectConflicts } from "./conflict-detection";
import { cloneToTarget } from "./sync-job";
import { connection, syncQueue } from "./queues";
import { sendEmail } from "./lib/email";

const prisma = new PrismaClient();

const activeSyncs = new Set<string>();

const conflictWorker = new Worker(
  "conflict-detection",
  async (job) => {
    const { userId } = job.data;
    console.log(`[conflicts] Running conflict detection for user ${userId}`);
    await detectConflicts(prisma, userId);
  },
  {
    connection,
    concurrency: 3,
  }
);

conflictWorker.on("completed", (job) => {
  console.log(`[conflicts] Job ${job.id} completed`);
});

conflictWorker.on("failed", (job, err) => {
  console.error(`[conflicts] Job ${job?.id} failed:`, err.message);
});

const targetSyncWorker = new Worker(
  "target-sync",
  async (job) => {
    const { userId } = job.data;
    console.log(`[target-sync] Running target sync for user ${userId}`);
    await cloneToTarget(prisma, userId);
  },
  { connection, concurrency: 1 }
);

targetSyncWorker.on("completed", (job) => {
  console.log(`[target-sync] Job ${job.id} completed`);
});

targetSyncWorker.on("failed", (job, err) => {
  console.error(`[target-sync] Job ${job?.id} failed:`, err.message);
});

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

const emailWorker = new Worker(
  "booking-email",
  async (job) => {
    await sendEmail(job.data);
  },
  { connection, concurrency: 3 }
);

emailWorker.on("failed", (job, err) => {
  console.error(`[email] Job ${job?.id} failed:`, err.message);
});

// Schedule repeating sync jobs for all active sources
async function scheduleSyncJobs() {
  const sources = await prisma.calendarSource.findMany({
    where: { syncStatus: { not: "disabled" } },
    select: { id: true, userId: true, syncInterval: true },
  });

  const activeIds = new Set(sources.map((s) => `sync-${s.id}`));

  // Remove orphaned schedulers that no longer have a source in the DB
  const schedulers = await syncQueue.getJobSchedulers();
  for (const sched of schedulers) {
    if (sched.id && !activeIds.has(sched.id)) {
      await syncQueue.removeJobScheduler(sched.id);
      console.log(`[sync] Removed orphaned scheduler: ${sched.id}`);
    }
  }

  for (const source of sources) {
    await syncQueue.upsertJobScheduler(
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
