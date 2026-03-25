import { PrismaClient, CalendarSource, CalendarEntry } from "@prisma/client";
import { decrypt } from "./encryption";
import {
  CalendarProviderInterface,
  EventDelta,
  TokenSet,
} from "./types";
import { ProviderError, ProviderErrorCode } from "./errors";
import { getProvider } from "./providers";

export async function processSyncJob(
  prisma: PrismaClient,
  sourceId: string,
  userId: string
): Promise<void> {
  const source = await prisma.calendarSource.findFirst({
    where: { id: sourceId, userId },
    include: { calendarEntries: { where: { enabled: true } } },
  });

  if (!source) {
    console.warn(`[sync] Source ${sourceId} not found, skipping`);
    return;
  }

  // Mark as syncing
  await prisma.calendarSource.update({
    where: { id: sourceId },
    data: { syncStatus: "syncing", syncError: null },
  });

  // ICS sources are synced via URL fetch, not through the provider interface
  if (source.provider === "ics") {
    // Re-fetch ICS URL if configured
    if (source.icsUrl) {
      await syncIcsSource(prisma, source);
    }
    await prisma.calendarSource.update({
      where: { id: sourceId },
      data: { syncStatus: "ok", lastSyncAt: new Date(), syncError: null },
    });
    return;
  }

  try {
    const credentials = JSON.parse(
      decrypt(source.credentials, process.env.ENCRYPTION_SECRET!)
    );

    const provider = getProvider(source.provider);
    const token: TokenSet = {
      accessToken: credentials.accessToken || credentials.access_token || "",
      refreshToken: credentials.refreshToken || credentials.refresh_token || null,
      expiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : null,
    };

    // Sync each enabled calendar entry
    for (const entry of source.calendarEntries) {
      try {
        await syncCalendarEntry(prisma, provider, token, entry, source.syncToken, userId, source.fetchDaysInAdvance);
      } catch (err) {
        if (
          err instanceof ProviderError &&
          err.code === ProviderErrorCode.INVALID_SYNC_TOKEN
        ) {
          // Full sync fallback
          console.log(`[sync] Sync token expired for ${entry.id}, doing full sync`);
          await syncCalendarEntry(prisma, provider, token, entry, null, userId, source.fetchDaysInAdvance);
        } else {
          throw err;
        }
      }
    }

    // Clone to target calendar if configured
    await cloneToTarget(prisma, provider, token, userId);

    // Mark sync success
    await prisma.calendarSource.update({
      where: { id: sourceId },
      data: {
        syncStatus: "ok",
        lastSyncAt: new Date(),
        syncError: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[sync] Error syncing source ${sourceId}:`, message);

    await prisma.calendarSource.update({
      where: { id: sourceId },
      data: {
        syncStatus: "error",
        syncError: message,
      },
    });

    throw err; // Let BullMQ handle retries
  }
}

async function syncCalendarEntry(
  prisma: PrismaClient,
  provider: CalendarProviderInterface,
  token: TokenSet,
  entry: { id: string; sourceId: string; providerCalendarId: string },
  syncToken: string | null,
  userId: string,
  fetchDaysInAdvance?: number
): Promise<void> {
  const delta: EventDelta = await provider.getEvents(
    token,
    entry.providerCalendarId,
    syncToken,
    fetchDaysInAdvance
  );

  // Process created events in a single transaction
  if (delta.created.length > 0) {
    await prisma.$transaction(
      delta.created.map((event) =>
        prisma.event.upsert({
          where: {
            calendarEntryId_sourceEventId: {
              calendarEntryId: entry.id,
              sourceEventId: event.sourceEventId,
            },
          },
          create: {
            calendarEntryId: entry.id,
            sourceEventId: event.sourceEventId,
            title: event.title,
            description: event.description,
            location: event.location,
            startTime: event.startTime,
            endTime: event.endTime,
            allDay: event.allDay,
            providerMetadata: event.providerMetadata as object ?? undefined,
          },
          update: {
            title: event.title,
            description: event.description,
            location: event.location,
            startTime: event.startTime,
            endTime: event.endTime,
            allDay: event.allDay,
            providerMetadata: event.providerMetadata as object ?? undefined,
          },
        })
      )
    );
  }

  // Process updated events
  for (const event of delta.updated) {
    await prisma.event.updateMany({
      where: {
        calendarEntryId: entry.id,
        sourceEventId: event.sourceEventId,
      },
      data: {
        title: event.title,
        description: event.description,
        location: event.location,
        startTime: event.startTime,
        endTime: event.endTime,
        allDay: event.allDay,
      },
    });
  }

  // Process deletions in batch — propagate to target calendar
  if (delta.deleted.length > 0) {
    const localEvents = await prisma.event.findMany({
      where: {
        calendarEntryId: entry.id,
        sourceEventId: { in: delta.deleted },
      },
      select: { id: true },
    });

    const localEventIds = localEvents.map((e: { id: string }) => e.id);

    if (localEventIds.length > 0) {
      // Delete cloned events from target calendar before removing local data
      const targetMappings = await prisma.targetEventMapping.findMany({
        where: { sourceEventId: { in: localEventIds } },
        include: { targetCalendar: { include: { source: true } } },
      });

      for (const mapping of targetMappings) {
        try {
          const targetProvider = getProvider(mapping.targetCalendar.source.provider);
          const targetCreds = JSON.parse(
            decrypt(mapping.targetCalendar.source.credentials, process.env.ENCRYPTION_SECRET!)
          );
          const targetToken: TokenSet = {
            accessToken: targetCreds.accessToken || "",
            refreshToken: targetCreds.refreshToken || null,
            expiresAt: targetCreds.expiresAt ? new Date(targetCreds.expiresAt) : null,
          };
          await targetProvider.deleteEvent(
            targetToken,
            mapping.targetCalendar.providerCalendarId,
            mapping.targetEventId
          );
        } catch (err) {
          console.error(`[sync] Failed to delete target event ${mapping.targetEventId}:`, err);
        }
      }

      await prisma.targetEventMapping.deleteMany({
        where: { sourceEventId: { in: localEventIds } },
      });
      await prisma.event.deleteMany({
        where: { id: { in: localEventIds } },
      });
    }
  }

  // Update sync token if provider returned one
  if (delta.nextSyncToken) {
    await prisma.calendarSource.update({
      where: { id: entry.sourceId },
      data: { syncToken: delta.nextSyncToken },
    });
  }
}

async function cloneToTarget(
  prisma: PrismaClient,
  provider: CalendarProviderInterface,
  token: TokenSet,
  userId: string
): Promise<void> {
  // Find ALL target calendars for this user
  const targetEntries = await prisma.calendarEntry.findMany({
    where: {
      isTarget: true,
      source: { userId },
    },
    include: { source: true, sourceCalendars: { select: { id: true } } },
  });

  if (targetEntries.length === 0) return;

  for (const targetEntry of targetEntries) {
    await cloneToSingleTarget(prisma, userId, targetEntry);
  }
}

async function cloneToSingleTarget(
  prisma: PrismaClient,
  userId: string,
  targetEntry: {
    id: string;
    providerCalendarId: string;
    syncMode: string;
    syncDaysInAdvance: number;
    skipWorkLocation: boolean;
    skipSingleDayAllDay: boolean;
    skipDeclined: boolean;
    skipFree: boolean;
    source: { provider: string; credentials: string };
    sourceCalendars: Array<{ id: string }>;
  }
): Promise<void> {
  const sourceCalendarIds = targetEntry.sourceCalendars?.map((c) => c.id);
  const isBlocked = targetEntry.syncMode === "blocked";

  const targetProvider = getProvider(targetEntry.source.provider);
  const targetCredentials = JSON.parse(
    decrypt(targetEntry.source.credentials, process.env.ENCRYPTION_SECRET!)
  );
  const targetToken: TokenSet = {
    accessToken: targetCredentials.accessToken || "",
    refreshToken: targetCredentials.refreshToken || null,
    expiresAt: targetCredentials.expiresAt ? new Date(targetCredentials.expiresAt) : null,
  };

  // Orphan cleanup: remove mappings whose source events no longer exist
  const allMappings = await prisma.targetEventMapping.findMany({
    where: { targetCalendarEntryId: targetEntry.id },
    select: { id: true, sourceEventId: true, targetEventId: true },
  });

  const existingEventIds = new Set(
    (await prisma.event.findMany({
      where: { id: { in: allMappings.map((m: { sourceEventId: string }) => m.sourceEventId) } },
      select: { id: true },
    })).map((e: { id: string }) => e.id)
  );

  const orphans = allMappings.filter(
    (m: { sourceEventId: string }) => !existingEventIds.has(m.sourceEventId)
  );

  for (const orphan of orphans) {
    try {
      await targetProvider.deleteEvent(
        targetToken,
        targetEntry.providerCalendarId,
        orphan.targetEventId
      );
    } catch (err) {
      console.error(`[sync] Failed to delete orphaned target event ${orphan.targetEventId}:`, err);
    }
  }

  if (orphans.length > 0) {
    await prisma.targetEventMapping.deleteMany({
      where: { id: { in: orphans.map((o: { id: string }) => o.id) } },
    });
    console.log(`[sync] Cleaned up ${orphans.length} orphaned target mappings`);
  }

  // Find all local events that don't have a target mapping yet,
  // filtered by the configured sync window
  const syncCutoff = new Date();
  syncCutoff.setDate(syncCutoff.getDate() + targetEntry.syncDaysInAdvance);

  const unmappedEvents = await prisma.event.findMany({
    where: {
      calendarEntry: {
        source: { userId },
        isTarget: false,
        ...(sourceCalendarIds && sourceCalendarIds.length > 0
          ? { id: { in: sourceCalendarIds } }
          : { enabled: true }),
      },
      // Loop prevention: skip events that were synced in from another target
      title: { not: { startsWith: "[Sync]" } },
      startTime: { lte: syncCutoff },
      sourceMappings: {
        none: { targetCalendarEntryId: targetEntry.id },
      },
    },
  });

  const DAY_MS = 24 * 60 * 60 * 1000;
  const filteredEvents = unmappedEvents.filter((event) => {
    const meta = event.providerMetadata as Record<string, unknown> | null;
    if (targetEntry.skipWorkLocation) {
      if (meta?.eventType === "workingLocation") return false;
    }
    if (targetEntry.skipSingleDayAllDay && event.allDay) {
      const duration = new Date(event.endTime).getTime() - new Date(event.startTime).getTime();
      if (duration <= DAY_MS) return false;
    }
    if (targetEntry.skipDeclined) {
      if (meta?.responseStatus === "declined") return false;
    }
    if (targetEntry.skipFree) {
      if (meta?.showAs === "free" || meta?.showAs === "tentative" || meta?.transparency === "transparent") return false;
    }
    return true;
  });

  // Build a fingerprint set from already-mapped events to avoid duplicating
  // events that appear across multiple source calendars
  const existingMappings = await prisma.targetEventMapping.findMany({
    where: { targetCalendarEntryId: targetEntry.id },
    include: { sourceEvent: { select: { title: true, startTime: true, endTime: true } } },
  });

  const eventFingerprint = (title: string, start: Date, end: Date) =>
    `${title}|${new Date(start).toISOString()}|${new Date(end).toISOString()}`;

  const fingerprintToTargetId = new Map<string, string>();
  for (const m of existingMappings) {
    const fp = eventFingerprint(m.sourceEvent.title, m.sourceEvent.startTime, m.sourceEvent.endTime);
    fingerprintToTargetId.set(fp, m.targetEventId);
  }

  // Helper: build event payload respecting syncMode
  function buildEventPayload(event: { title: string; description: string | null; location: string | null; startTime: Date; endTime: Date; allDay: boolean }) {
    return {
      title: isBlocked ? "[Sync] Busy" : `[Sync] ${event.title}`,
      description: isBlocked ? null : event.description,
      location: isBlocked ? null : event.location,
      startTime: event.startTime,
      endTime: event.endTime,
      allDay: event.allDay,
    };
  }

  for (const event of filteredEvents) {
    const fp = eventFingerprint(event.title, event.startTime, event.endTime);
    const existingTargetId = fingerprintToTargetId.get(fp);

    if (existingTargetId) {
      try {
        await prisma.targetEventMapping.create({
          data: {
            sourceEventId: event.id,
            targetEventId: existingTargetId,
            targetCalendarEntryId: targetEntry.id,
          },
        });
        console.log(`[sync] Reused existing target event for "${event.title}" (dedup by fingerprint)`);
      } catch (dupErr) {
        // Mapping already exists, skip
      }
      continue;
    }

    try {
      const cloned = await targetProvider.createEvent(
        targetToken,
        targetEntry.providerCalendarId,
        buildEventPayload(event)
      );

      try {
        await prisma.targetEventMapping.create({
          data: {
            sourceEventId: event.id,
            targetEventId: cloned.sourceEventId,
            targetCalendarEntryId: targetEntry.id,
          },
        });
      } catch (dupErr) {
        try {
          await targetProvider.deleteEvent(targetToken, targetEntry.providerCalendarId, cloned.sourceEventId);
          console.log(`[sync] Cleaned up duplicate target event for "${event.title}"`);
        } catch {
          console.error(`[sync] Failed to clean up duplicate target event ${cloned.sourceEventId}`);
        }
      }

      fingerprintToTargetId.set(fp, cloned.sourceEventId);
    } catch (err) {
      console.error(`[sync] Failed to clone event ${event.id} to target:`, err);
    }
  }

  // Handle updates: only push to target if source event changed since last sync
  const mappedEvents = await prisma.targetEventMapping.findMany({
    where: { targetCalendarEntryId: targetEntry.id },
    include: { sourceEvent: true },
  });

  const staleEntries = mappedEvents.filter(
    (m: { lastSyncedAt: Date | null; sourceEvent: { updatedAt: Date } }) =>
      !m.lastSyncedAt || m.sourceEvent.updatedAt > m.lastSyncedAt
  );

  const CHUNK_SIZE = 5;
  for (let i = 0; i < staleEntries.length; i += CHUNK_SIZE) {
    const chunk = staleEntries.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (mapping: { id: string; targetEventId: string; sourceEvent: { title: string; description: string | null; location: string | null; startTime: Date; endTime: Date; allDay: boolean } }) => {
        try {
          await targetProvider.updateEvent(
            targetToken,
            targetEntry.providerCalendarId,
            mapping.targetEventId,
            buildEventPayload(mapping.sourceEvent)
          );
          await prisma.targetEventMapping.update({
            where: { id: mapping.id },
            data: { lastSyncedAt: new Date() },
          });
        } catch (err) {
          console.error(`[sync] Failed to update target event ${mapping.targetEventId}:`, err);
        }
      })
    );
  }
}

async function syncIcsSource(
  prisma: PrismaClient,
  source: CalendarSource & { calendarEntries: CalendarEntry[] }
): Promise<void> {
  if (!source.icsUrl) return;

  const res = await fetch(source.icsUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch ICS URL: ${res.status}`);
  }

  const icsData = await res.text();
  if (!icsData.includes("BEGIN:VCALENDAR")) {
    throw new Error("URL does not return valid iCalendar data");
  }

  // Simple ICS parser (same logic as ics.ts route)
  const unfolded = icsData.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const eventBlocks = unfolded.split("BEGIN:VEVENT");
  const events: { uid: string; title: string; description: string | null; location: string | null; startTime: Date; endTime: Date; allDay: boolean }[] = [];

  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i].split("END:VEVENT")[0];
    const uid = block.match(/UID:(.*)/)?.[1]?.trim();
    const summary = block.match(/SUMMARY:(.*)/)?.[1]?.trim();
    const dtStartRaw = block.match(/DTSTART[^:]*:(.*)/)?.[1]?.trim();
    const dtEndRaw = block.match(/DTEND[^:]*:(.*)/)?.[1]?.trim();
    const description = block.match(/DESCRIPTION:(.*)/)?.[1]?.trim();
    const location = block.match(/LOCATION:(.*)/)?.[1]?.trim();

    if (!uid || !dtStartRaw) continue;

    const allDay = dtStartRaw.length === 8;
    events.push({
      uid,
      title: summary || "(No title)",
      description: description || null,
      location: location || null,
      startTime: parseIcsDate(dtStartRaw),
      endTime: dtEndRaw ? parseIcsDate(dtEndRaw) : parseIcsDate(dtStartRaw),
      allDay,
    });
  }

  for (const entry of source.calendarEntries) {
    for (const ev of events) {
      await prisma.event.upsert({
        where: {
          calendarEntryId_sourceEventId: {
            calendarEntryId: entry.id,
            sourceEventId: ev.uid,
          },
        },
        create: {
          calendarEntryId: entry.id,
          sourceEventId: ev.uid,
          title: ev.title,
          description: ev.description,
          location: ev.location,
          startTime: ev.startTime,
          endTime: ev.endTime,
          allDay: ev.allDay,
        },
        update: {
          title: ev.title,
          description: ev.description,
          location: ev.location,
          startTime: ev.startTime,
          endTime: ev.endTime,
          allDay: ev.allDay,
        },
      });
    }
  }

  console.log(`[sync] ICS source ${source.id}: synced ${events.length} events`);
}

function parseIcsDate(dateStr: string): Date {
  if (dateStr.length === 8) {
    return new Date(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`);
  }
  const formatted = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}T${dateStr.slice(9, 11)}:${dateStr.slice(11, 13)}:${dateStr.slice(13, 15)}Z`;
  return new Date(formatted);
}

