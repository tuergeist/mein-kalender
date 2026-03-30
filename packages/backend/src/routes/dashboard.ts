import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";

interface AuthenticatedRequest {
  user: AuthUser;
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

  // Weekly summary: meetings, overlaps, calendars, sync success
  app.get("/api/dashboard/weekly-summary", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [eventCount, conflictsDetected, calendarCount, healthRecords] = await Promise.all([
      prisma.event.count({
        where: {
          calendarEntry: { source: { userId: user.id }, enabled: true },
          startTime: { lt: endOfWeek },
          endTime: { gte: startOfWeek },
          title: { not: { startsWith: "[Sync]" } },
        },
      }),
      prisma.conflict.count({
        where: { userId: user.id, detectedAt: { gte: startOfWeek, lt: endOfWeek } },
      }),
      prisma.calendarSource.count({ where: { userId: user.id } }),
      prisma.syncHealth.findMany({
        where: { userId: user.id, createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
        select: { checksumMatch: true, latencyMs: true },
      }),
    ]);

    const totalCycles = healthRecords.length;
    const matchingCycles = healthRecords.filter((r) => r.checksumMatch).length;
    const syncSuccessRate = totalCycles > 0 ? Math.round((matchingCycles / totalCycles) * 1000) / 10 : 100;

    const latencies = healthRecords.map((r) => r.latencyMs).sort((a, b) => a - b);
    const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;

    return {
      weekStart: startOfWeek.toISOString(),
      meetings: eventCount,
      overlapsDetected: conflictsDetected,
      calendarsConnected: calendarCount,
      syncSuccessRate,
      syncCycles: totalCycles,
      latency: { p50, p95 },
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

  // Recent conflicts
  app.get("/api/dashboard/conflicts", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const conflicts = await prisma.conflict.findMany({
      where: { userId: user.id, resolvedAt: null },
      orderBy: { detectedAt: "desc" },
      take: 10,
    });

    return { conflicts };
  });
}
