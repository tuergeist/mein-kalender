import { Queue } from "bullmq";

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return { host: parsed.hostname, port: parseInt(parsed.port || "6379") };
}

const connection = parseRedisUrl(process.env.REDIS_URL || "redis://localhost:6379");

// Without retention limits BullMQ keeps every finished job hash in Redis. The
// repeating sync schedulers produce one job per source per interval, so the
// keys grow without bound — by 2026-08 that was 79k keys / 116 MB against a
// 128 Mi limit, and the Redis pod got OOM-killed. These defaults are merged
// into every add() and into the job templates of upsertJobScheduler().
const defaultJobOptions = {
  removeOnComplete: { age: 3600, count: 200 },
  removeOnFail: { age: 86400, count: 200 },
};

export const syncQueue = new Queue("calendar-sync", { connection, defaultJobOptions });

export const conflictQueue = new Queue("conflict-detection", { connection, defaultJobOptions });

export const targetSyncQueue = new Queue("target-sync", { connection, defaultJobOptions });

export const emailQueue = new Queue("booking-email", { connection, defaultJobOptions });

export const allQueues = [syncQueue, conflictQueue, targetSyncQueue, emailQueue];

export { connection, defaultJobOptions };
