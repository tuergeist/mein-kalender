import { PrismaClient } from "@prisma/client";
import { decrypt } from "./encryption";
import {
  Provider,
  CalendarProviderInterface,
  EventDelta,
  TokenSet,
  NormalizedEvent,
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
        await syncCalendarEntry(prisma, provider, token, entry, source.syncToken);
      } catch (err) {
        if (
          err instanceof ProviderError &&
          err.code === ProviderErrorCode.INVALID_SYNC_TOKEN
        ) {
          // Full sync fallback
          console.log(`[sync] Sync token expired for ${entry.id}, doing full sync`);
          await syncCalendarEntry(prisma, provider, token, entry, null);
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
  syncToken: string | null
): Promise<void> {
  const delta: EventDelta = await provider.getEvents(
    token,
    entry.providerCalendarId,
    syncToken
  );

  // Process created events
  for (const event of delta.created) {
    await prisma.event.upsert({
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
    });
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

  // Process deletions
  for (const sourceEventId of delta.deleted) {
    // Also clean up target mappings
    const localEvent = await prisma.event.findFirst({
      where: { calendarEntryId: entry.id, sourceEventId },
    });

    if (localEvent) {
      await prisma.targetEventMapping.deleteMany({
        where: { sourceEventId: localEvent.id },
      });
      await prisma.event.delete({ where: { id: localEvent.id } });
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
  // Find the user's target calendar
  const targetEntry = await prisma.calendarEntry.findFirst({
    where: {
      isTarget: true,
      source: { userId },
    },
    include: { source: true },
  });

  if (!targetEntry) return; // No target configured, skip

  // Find all local events that don't have a target mapping yet
  const unmappedEvents = await prisma.event.findMany({
    where: {
      calendarEntry: {
        source: { userId },
        isTarget: false,
        enabled: true,
      },
      sourceMappings: {
        none: { targetCalendarEntryId: targetEntry.id },
      },
    },
  });

  const targetProvider = getProvider(targetEntry.source.provider);
  const targetCredentials = JSON.parse(
    decrypt(targetEntry.source.credentials, process.env.ENCRYPTION_SECRET!)
  );
  const targetToken: TokenSet = {
    accessToken: targetCredentials.accessToken || "",
    refreshToken: targetCredentials.refreshToken || null,
    expiresAt: targetCredentials.expiresAt ? new Date(targetCredentials.expiresAt) : null,
  };

  for (const event of unmappedEvents) {
    try {
      const cloned = await targetProvider.createEvent(
        targetToken,
        targetEntry.providerCalendarId,
        {
          title: `[Sync] ${event.title}`,
          description: event.description,
          location: event.location,
          startTime: event.startTime,
          endTime: event.endTime,
          allDay: event.allDay,
        }
      );

      await prisma.targetEventMapping.create({
        data: {
          sourceEventId: event.id,
          targetEventId: cloned.sourceEventId,
          targetCalendarEntryId: targetEntry.id,
        },
      });
    } catch (err) {
      console.error(`[sync] Failed to clone event ${event.id} to target:`, err);
      // Continue with other events
    }
  }

  // Handle updates: find events that have mappings and have been updated
  const mappedEvents = await prisma.targetEventMapping.findMany({
    where: { targetCalendarEntryId: targetEntry.id },
    include: { sourceEvent: true },
  });

  for (const mapping of mappedEvents) {
    try {
      await targetProvider.updateEvent(
        targetToken,
        targetEntry.providerCalendarId,
        mapping.targetEventId,
        {
          title: `[Sync] ${mapping.sourceEvent.title}`,
          description: mapping.sourceEvent.description,
          location: mapping.sourceEvent.location,
          startTime: mapping.sourceEvent.startTime,
          endTime: mapping.sourceEvent.endTime,
          allDay: mapping.sourceEvent.allDay,
        }
      );
    } catch (err) {
      console.error(`[sync] Failed to update target event ${mapping.targetEventId}:`, err);
    }
  }
}

