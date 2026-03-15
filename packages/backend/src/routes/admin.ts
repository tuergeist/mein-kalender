import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../lib/auth";
import { Queue } from "bullmq";

let syncQueue: Queue | null = null;

function getSyncQueue(): Queue {
  if (!syncQueue) {
    syncQueue = new Queue("calendar-sync", {
      connection: {
        host: new URL(process.env.REDIS_URL || "redis://localhost:6379").hostname,
        port: parseInt(
          new URL(process.env.REDIS_URL || "redis://localhost:6379").port || "6379"
        ),
      },
    });
  }
  return syncQueue;
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  // List users with calendar source count and login providers
  app.get<{
    Querystring: { search?: string; page?: string; limit?: string };
  }>("/api/admin/users", async (request) => {
    const search = request.query.search || "";
    const page = Math.max(1, parseInt(request.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || "20", 10)));
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { displayName: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          createdAt: true,
          _count: { select: { calendarSources: true } },
          accounts: { select: { provider: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        createdAt: u.createdAt,
        calendarSourceCount: u._count.calendarSources,
        providers: u.accounts.map((a: { provider: string }) => a.provider),
      })),
      total,
      page,
      limit,
    };
  });

  // Sync queue status and recent jobs
  app.get("/api/admin/sync", async () => {
    const queue = getSyncQueue();

    const counts = await queue.getJobCounts(
      "active",
      "waiting",
      "completed",
      "failed"
    );

    const jobs = await queue.getJobs(
      ["active", "waiting", "completed", "failed"],
      0,
      49
    );

    // Sort by timestamp descending
    jobs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Resolve user emails and source labels for job data
    const userIds = [...new Set(jobs.map((j) => j.data?.userId).filter(Boolean))];
    const sourceIds = [...new Set(jobs.map((j) => j.data?.sourceId).filter(Boolean))];
    const [users, sources] = await Promise.all([
      userIds.length
        ? prisma.user.findMany({
            where: { id: { in: userIds as string[] } },
            select: { id: true, email: true },
          })
        : [],
      sourceIds.length
        ? prisma.calendarSource.findMany({
            where: { id: { in: sourceIds as string[] } },
            select: { id: true, label: true, provider: true },
          })
        : [],
    ]);
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.email]));
    const sourceMap = Object.fromEntries(
      sources.map((s) => [s.id, { label: s.label, provider: s.provider }])
    );

    return {
      counts,
      jobs: jobs.map((j) => ({
        id: j.id,
        name: j.name,
        state: j.finishedOn
          ? j.failedReason
            ? "failed"
            : "completed"
          : j.processedOn
            ? "active"
            : "waiting",
        data: j.data,
        userEmail: j.data?.userId ? userMap[j.data.userId] || null : null,
        sourceLabel: j.data?.sourceId ? sourceMap[j.data.sourceId]?.label || null : null,
        sourceProvider: j.data?.sourceId ? sourceMap[j.data.sourceId]?.provider || null : null,
        timestamp: j.timestamp,
        processedOn: j.processedOn,
        finishedOn: j.finishedOn,
        failedReason: j.failedReason,
        attemptsMade: j.attemptsMade,
      })),
    };
  });
}
