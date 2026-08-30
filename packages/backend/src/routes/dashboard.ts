import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";

interface AuthenticatedRequest {
  user: AuthUser;
}

// Erfolgsrate und Latenz aus den SyncHealth-Zyklen eines Zeitraums.
function syncMetrics(records: { checksumMatch: boolean; latencyMs: number }[]) {
  const syncCycles = records.length;
  const matchingCycles = records.filter((r) => r.checksumMatch).length;
  const syncSuccessRate = syncCycles > 0 ? Math.round((matchingCycles / syncCycles) * 1000) / 10 : 100;

  const latencies = records.map((r) => r.latencyMs).sort((a, b) => a - b);
  const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
  const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;

  return { syncSuccessRate, syncCycles, latency: { p50, p95 } };
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // Daily briefing: today's events, conflict count, next meeting
  app.get("/api/dashboard/briefing", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const [events, unresolvedConflicts, sources] = await Promise.all([
      prisma.event.findMany({
        where: {
          calendarEntry: { source: { userId: user.id }, enabled: true },
          startTime: { lt: endOfDay },
          endTime: { gte: startOfDay },
          title: { not: { startsWith: "[Sync]" } },
        },
        orderBy: { startTime: "asc" },
        include: {
          calendarEntry: {
            select: { name: true, color: true, source: { select: { provider: true, label: true } } },
          },
        },
      }),
      prisma.conflict.count({
        where: { userId: user.id, resolvedAt: null },
      }),
      prisma.calendarSource.findMany({
        where: { userId: user.id },
        select: { id: true, provider: true, label: true },
      }),
    ]);

    const nextMeeting = events.find((e) => new Date(e.startTime) > now);
    const minutesUntilNext = nextMeeting
      ? Math.round((new Date(nextMeeting.startTime).getTime() - now.getTime()) / 60000)
      : null;

    // Count unique source providers for "across N organizations"
    const providerSet = new Set(events.map((e) => e.calendarEntry.source.provider));

    return {
      date: startOfDay.toISOString(),
      totalEvents: events.length,
      organizationCount: providerSet.size,
      unresolvedConflicts,
      nextMeeting: nextMeeting
        ? {
            title: nextMeeting.title,
            startTime: nextMeeting.startTime,
            minutesUntil: minutesUntilNext,
            source: nextMeeting.calendarEntry.source.label || nextMeeting.calendarEntry.source.provider,
          }
        : null,
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        startTime: e.startTime,
        endTime: e.endTime,
        allDay: e.allDay,
        calendar: e.calendarEntry.name,
        color: e.calendarEntry.color,
        provider: e.calendarEntry.source.provider,
        source: e.calendarEntry.source.label || e.calendarEntry.source.provider,
      })),
    };
  });

  // Summary: meetings, overlaps, calendars, sync success (configurable period)
  app.get<{
    Querystring: { period?: string };
  }>("/api/dashboard/weekly-summary", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const period = request.query.period || "7d";

    const now = new Date();
    let periodStart: Date;
    let periodLabel: string;

    switch (period) {
      case "24h":
        periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        periodLabel = "24h";
        break;
      case "30d":
        periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        periodLabel = "30d";
        break;
      default:
        // 7d — rollend wie 24h und 30d. Der frühere Wochenstart ab Montag
        // rechnete sonntags in die Zukunft (getDay() ist dann 0) und lieferte
        // ein leeres Fenster.
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        periodLabel = "7d";
    }

    const periodEnd = new Date(now);

    // Der Status auf dem Dashboard hängt an den letzten 24 Stunden; die
    // längeren Zeiträume liefern nur den Kontext. Beide kommen aus einer
    // Abfrage über den früheren der beiden Startpunkte.
    const last24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const healthStart = periodStart < last24hStart ? periodStart : last24hStart;

    const [eventCount, conflictsDetected, calendarCount, healthRecords] = await Promise.all([
      prisma.event.count({
        where: {
          calendarEntry: { source: { userId: user.id }, enabled: true },
          startTime: { lt: periodEnd },
          endTime: { gte: periodStart },
          title: { not: { startsWith: "[Sync]" } },
        },
      }),
      prisma.conflict.count({
        where: { userId: user.id, detectedAt: { gte: periodStart, lt: periodEnd } },
      }),
      prisma.calendarSource.count({ where: { userId: user.id } }),
      prisma.syncHealth.findMany({
        where: { userId: user.id, createdAt: { gte: healthStart } },
        select: { checksumMatch: true, latencyMs: true, createdAt: true },
      }),
    ]);

    const periodMetrics = syncMetrics(healthRecords.filter((r) => r.createdAt >= periodStart));
    const last24h = syncMetrics(healthRecords.filter((r) => r.createdAt >= last24hStart));

    return {
      period: periodLabel,
      periodStart: periodStart.toISOString(),
      meetings: eventCount,
      overlapsDetected: conflictsDetected,
      calendarsConnected: calendarCount,
      ...periodMetrics,
      last24h,
    };
  });

  // Per-provider sync status
  app.get("/api/dashboard/sync-status", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const sources = await prisma.calendarSource.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        provider: true,
        label: true,
        syncStatus: true,
        syncError: true,
        lastSyncAt: true,
      },
      orderBy: { provider: "asc" },
    });

    return { sources };
  });

  // All unresolved conflicts
  app.get("/api/dashboard/conflicts", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const conflicts = await prisma.conflict.findMany({
      where: { userId: user.id, resolvedAt: null },
      orderBy: { detectedAt: "desc" },
    });

    return { conflicts };
  });

  // Manually resolve a conflict
  app.post<{ Params: { id: string } }>("/api/dashboard/conflicts/:id/resolve", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const { id } = request.params;

    const conflict = await prisma.conflict.findFirst({
      where: { id, userId: user.id, resolvedAt: null },
    });

    if (!conflict) {
      return reply.status(404).send({ error: "Conflict not found" });
    }

    await prisma.conflict.update({
      where: { id },
      data: { resolvedAt: new Date() },
    });

    return { ok: true };
  });

  // Clone/target sync statistics
  app.get("/api/dashboard/clone-stats", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const targets = await prisma.calendarEntry.findMany({
      where: { isTarget: true, source: { userId: user.id } },
      select: {
        id: true,
        name: true,
        syncMode: true,
        source: { select: { provider: true, label: true } },
      },
    });

    const stats = await Promise.all(
      targets.map(async (t) => {
        const [total, syncedLast24h, syncedLast7d, lastMapping] = await Promise.all([
          prisma.targetEventMapping.count({ where: { targetCalendarEntryId: t.id } }),
          prisma.targetEventMapping.count({
            where: { targetCalendarEntryId: t.id, lastSyncedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          }),
          prisma.targetEventMapping.count({
            where: { targetCalendarEntryId: t.id, lastSyncedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          }),
          prisma.targetEventMapping.findFirst({
            where: { targetCalendarEntryId: t.id },
            orderBy: { lastSyncedAt: "desc" },
            select: { lastSyncedAt: true },
          }),
        ]);
        return {
          id: t.id,
          name: t.name,
          provider: t.source.provider,
          label: t.source.label,
          syncMode: t.syncMode,
          totalMappings: total,
          syncedLast24h,
          syncedLast7d,
          lastSyncedAt: lastMapping?.lastSyncedAt || null,
        };
      })
    );

    return { targets: stats };
  });
}
