import { Queue } from "bullmq";

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return { host: parsed.hostname, port: parseInt(parsed.port || "6379") };
}

const connection = parseRedisUrl(process.env.REDIS_URL || "redis://localhost:6379");

export const syncQueue = new Queue("calendar-sync", { connection });

export const conflictQueue = new Queue("conflict-detection", { connection });

export const targetSyncQueue = new Queue("target-sync", { connection });

export const emailQueue = new Queue("booking-email", { connection });

export { connection };
