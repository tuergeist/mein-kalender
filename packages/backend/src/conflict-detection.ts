import { PrismaClient } from "@prisma/client";

interface EventWithSource {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  sourceId: string;
  provider: string;
}

export async function detectConflicts(
  prisma: PrismaClient,
  userId: string
): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Fetch upcoming events: non-all-day, non-sync, non-target, enabled calendars, not ignored
  const events = await prisma.event.findMany({
    where: {
      calendarEntry: {
        source: { userId },
        enabled: true,
      },
      allDay: false,
      ignored: false,
      title: { not: { startsWith: "[Sync]" } },
      startTime: { gte: now, lt: cutoff },
    },
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
      calendarEntry: {
        select: {
          sourceId: true,
          source: { select: { provider: true } },
        },
      },
    },
    orderBy: { startTime: "asc" },
    take: 500,
  });

  // Flatten into a simpler structure
  const flat: EventWithSource[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    startTime: e.startTime,
    endTime: e.endTime,
    sourceId: e.calendarEntry.sourceId,
    provider: e.calendarEntry.source.provider,
  }));

  // Detect cross-source overlaps
  const newConflicts: Array<{
    eventAId: string;
    eventBId: string;
    eventATitle: string;
    eventBTitle: string;
    eventAStart: Date;
    eventBStart: Date;
    eventASource: string;
    eventBSource: string;
  }> = [];

  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      const a = flat[i];
      const b = flat[j];

      // Only detect conflicts across different CalendarSources
      if (a.sourceId === b.sourceId) continue;

      // Once b starts after a ends, no more overlaps for a (sorted by startTime)
      if (b.startTime >= a.endTime) break;

      // Overlap check: a.start < b.end AND a.end > b.start
      if (a.startTime < b.endTime && a.endTime > b.startTime) {
        // Consistent ordering
        const [first, second] = a.id < b.id ? [a, b] : [b, a];
        newConflicts.push({
          eventAId: first.id,
          eventBId: second.id,
          eventATitle: first.title,
          eventBTitle: second.title,
          eventAStart: first.startTime,
          eventBStart: second.startTime,
          eventASource: first.provider,
          eventBSource: second.provider,
        });
      }
    }
  }

  // Build a set of detected pairs for comparison
  const detectedPairs = new Set(
    newConflicts.map((c) => `${c.eventAId}|${c.eventBId}`)
  );

  // Fetch existing unresolved conflicts
  const existingConflicts = await prisma.conflict.findMany({
    where: { userId, resolvedAt: null },
    select: { id: true, eventAId: true, eventBId: true },
  });

  // Auto-resolve stale conflicts
  const staleIds = existingConflicts
    .filter((c) => !detectedPairs.has(`${c.eventAId}|${c.eventBId}`))
    .map((c) => c.id);

  if (staleIds.length > 0) {
    await prisma.conflict.updateMany({
      where: { id: { in: staleIds } },
      data: { resolvedAt: new Date() },
    });
    console.log(`[conflicts] Resolved ${staleIds.length} stale conflicts for user ${userId}`);
  }

  // Build set of existing unresolved pairs to avoid duplicates
  const existingPairs = new Set(
    existingConflicts.map((c) => `${c.eventAId}|${c.eventBId}`)
  );

  // Upsert new conflicts
  const toCreate = newConflicts.filter(
    (c) => !existingPairs.has(`${c.eventAId}|${c.eventBId}`)
  );

  if (toCreate.length > 0) {
    await prisma.conflict.createMany({
      data: toCreate.map((c) => ({
        userId,
        eventAId: c.eventAId,
        eventBId: c.eventBId,
        eventATitle: c.eventATitle,
        eventBTitle: c.eventBTitle,
        eventAStart: c.eventAStart,
        eventBStart: c.eventBStart,
        eventASource: c.eventASource,
        eventBSource: c.eventBSource,
      })),
      skipDuplicates: true,
    });
    console.log(`[conflicts] Detected ${toCreate.length} new overlaps for user ${userId}`);
  }
}
