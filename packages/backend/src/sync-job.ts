import { PrismaClient, CalendarSource, CalendarEntry } from "@prisma/client";
import { decrypt } from "./encryption";
import {
  CalendarProviderInterface,
  EventDelta,
  TokenSet,
} from "./types";
import { ProviderError, ProviderErrorCode } from "./errors";
import { getProvider } from "./providers";
import { conflictQueue, targetSyncQueue } from "./queues";

// Adaptive backoff parameters: pause a source for `baseDelay * 2^consecutiveErrors`
// after each failure, capped at `maxBackoff`. Resets to 0 on a successful run.
const BACKOFF_BASE_DELAY_MS = 60_000; // 1 minute
const BACKOFF_MAX_MS = 30 * 60_000;   // 30 minutes

function computeBackoffMs(consecutiveErrors: number): number {
  // First failure (counter just incremented to 1) => baseDelay * 2 = 2 min.
  // Cap at maxBackoff. Guard the exponent against overflow for huge counts.
  const exponent = Math.min(consecutiveErrors, 20);
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_DELAY_MS * 2 ** exponent);
}

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

  // Adaptive backoff gate: if a previous run set nextSyncAfter and that time
  // is still in the future, skip this run entirely without touching status.
  const now = new Date();
  if (source.nextSyncAfter && source.nextSyncAfter > now) {
    const waitMs = source.nextSyncAfter.getTime() - now.getTime();
    console.debug(
      `[sync] Source ${sourceId} backed off, ${Math.round(waitMs / 1000)}s until gate clears`
    );
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
      data: {
        syncStatus: "ok",
        lastSyncAt: new Date(),
        syncError: null,
        consecutiveErrors: 0,
        nextSyncAfter: null,
      },
    });

    // Queue conflict detection for ICS sources too
    conflictQueue.add("detect-conflicts", { userId }, {
      jobId: `conflicts-${userId}-${Date.now()}`,
      removeOnComplete: 50,
      removeOnFail: 20,
    }).catch((err) => {
      console.warn("[sync] Failed to queue conflict detection:", err);
    });

    return;
  }

  const syncStart = Date.now();
  let eventsProcessed = 0;
  let eventsFailed = 0;

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
        eventsProcessed++;
      } catch (err) {
        if (
          err instanceof ProviderError &&
          err.code === ProviderErrorCode.INVALID_SYNC_TOKEN
        ) {
          // Full sync fallback
          console.log(`[sync] Sync token expired for ${entry.id}, doing full sync`);
          await syncCalendarEntry(prisma, provider, token, entry, null, userId, source.fetchDaysInAdvance);
          eventsProcessed++;
        } else {
          eventsFailed++;
          throw err;
        }
      }
    }

    // Queue target sync as a separate job (runs with concurrency 1 to avoid races)
    targetSyncQueue.add("target-sync", { userId }, {
      jobId: `target-sync-${userId}-${Date.now()}`,
      removeOnComplete: 50,
      removeOnFail: 20,
    }).catch((err) => {
      console.warn("[sync] Failed to queue target sync:", err);
    });

    // Mark sync success
    await prisma.calendarSource.update({
      where: { id: sourceId },
      data: {
        syncStatus: "ok",
        lastSyncAt: new Date(),
        syncError: null,
        consecutiveErrors: 0,
        nextSyncAfter: null,
      },
    });

    // Log sync health (fire-and-forget)
    logSyncHealth(prisma, userId, sourceId, source.provider, syncStart, eventsProcessed, eventsFailed, true);

    // Queue conflict detection as a separate async job (fire-and-forget)
    conflictQueue.add("detect-conflicts", { userId }, {
      jobId: `conflicts-${userId}-${Date.now()}`,
      removeOnComplete: 50,
      removeOnFail: 20,
    }).catch((err) => {
      console.warn("[sync] Failed to queue conflict detection:", err);
    });

    // Reconcile bookings: cancel confirmed bookings whose provider event no longer exists
    reconcileBookings(prisma, userId).catch((err) => {
      console.warn("[sync] Failed to reconcile bookings:", err);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const errName = err instanceof Error ? err.name : typeof err;
    const errCode =
      err instanceof ProviderError
        ? err.code
        : err instanceof Error && "code" in err
          ? String((err as Error & { code: unknown }).code)
          : null;
    console.error(
      `[sync] Error syncing source ${sourceId} [${errName}${errCode ? ":" + errCode : ""}]:`,
      message
    );

    // Only reset syncToken on a genuinely invalid/expired token. Transport
    // errors (DNS, ECONNRESET, "fetch failed") leave the token alone so the
    // next run resumes incremental sync instead of doing an expensive full
    // calendarView refetch.
    const wipeSyncToken =
      err instanceof ProviderError && err.code === ProviderErrorCode.INVALID_SYNC_TOKEN;

    // Adaptive backoff: increment counter and gate the next run. Applies to
    // every error path (RATE_LIMITED, transport errors, etc.) so a single
    // misbehaving source can't burn a sync slot every tick.
    const nextErrors = source.consecutiveErrors + 1;
    const nextSyncAfter = new Date(Date.now() + computeBackoffMs(nextErrors));

    await prisma.calendarSource.update({
      where: { id: sourceId },
      data: {
        syncStatus: "error",
        syncError: message,
        consecutiveErrors: nextErrors,
        nextSyncAfter,
        ...(wipeSyncToken ? { syncToken: null } : {}),
      },
    });

    // Log sync health even on failure (fire-and-forget)
    logSyncHealth(prisma, userId, sourceId, source.provider, syncStart, eventsProcessed, eventsFailed, false);

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
  const isFullSync = !syncToken;
  const delta: EventDelta = await provider.getEvents(
    token,
    entry.providerCalendarId,
    syncToken,
    fetchDaysInAdvance
  );

  // Strip internal delta flags from providerMetadata before persisting
  function cleanMetadata(meta: Record<string, unknown> | undefined | null): object | undefined {
    if (!meta) return undefined;
    const { _subjectMissing, _bodyMissing, _locationMissing, ...rest } = meta;
    return Object.keys(rest).length > 0 ? rest : undefined;
  }

  // Process created events in a single transaction
  if (delta.created.length > 0) {
    await prisma.$transaction(
      delta.created.map((event) => {
        const meta = event.providerMetadata as Record<string, unknown> | null;
        const subjectMissing = meta?._subjectMissing === true;
        const bodyMissing = meta?._bodyMissing === true;
        const locationMissing = meta?._locationMissing === true;
        const cleaned = cleanMetadata(meta);

        // For upsert updates: only overwrite fields the provider actually returned
        const updateData: Record<string, unknown> = {
          startTime: event.startTime,
          endTime: event.endTime,
          allDay: event.allDay,
        };
        if (!subjectMissing) updateData.title = event.title;
        if (!bodyMissing) updateData.description = event.description;
        if (!locationMissing) updateData.location = event.location;
        if (cleaned) updateData.providerMetadata = cleaned;

        return prisma.event.upsert({
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
            providerMetadata: cleaned,
          },
          update: updateData,
        });
      })
    );
  }

  // Process updated events (also handles NEW events from delta responses).
  // Providers return ALL changed/new events in the "updated" array when using
  // a sync token — new events are NOT placed in "created". We must upsert so
  // genuinely new events are inserted rather than silently dropped by updateMany.
  //
  // Note: Delta responses from providers (especially Outlook Graph API) may
  // return sparse objects with only changed fields. We must avoid overwriting
  // existing data with empty/fallback values when a field was simply not
  // included in the delta response.
  for (const event of delta.updated) {
    const meta = event.providerMetadata as Record<string, unknown> | null;
    const subjectMissing = meta?._subjectMissing === true;
    const bodyMissing = meta?._bodyMissing === true;
    const locationMissing = meta?._locationMissing === true;

    const updateData: Record<string, unknown> = {
      startTime: event.startTime,
      endTime: event.endTime,
      allDay: event.allDay,
    };

    // Only update fields that the provider actually returned in the delta.
    // Outlook's Graph API delta endpoint may omit unchanged fields.
    if (!subjectMissing) {
      updateData.title = event.title;
    }
    if (!bodyMissing) {
      updateData.description = event.description;
    }
    if (!locationMissing) {
      updateData.location = event.location;
    }

    const cleaned = cleanMetadata(meta);
    if (cleaned) {
      updateData.providerMetadata = cleaned;
    }

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
        providerMetadata: cleaned,
      },
      update: updateData,
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

  // Full sync orphan cleanup: remove DB events that the provider no longer returns.
  // Delta sync handles deletions via @removed/isCancelled, but full sync only returns
  // the current set of events — anything in the DB but not in that set is a ghost.
  if (isFullSync && delta.created.length > 0) {
    const providerEventIds = new Set(delta.created.map((e) => e.sourceEventId));
    const dbEvents = await prisma.event.findMany({
      where: { calendarEntryId: entry.id },
      select: { id: true, sourceEventId: true, title: true },
    });

    const orphans = dbEvents.filter((e) => !providerEventIds.has(e.sourceEventId));
    if (orphans.length > 0) {
      const orphanIds = orphans.map((e) => e.id);
      console.log(`[sync] Full sync orphan cleanup: removing ${orphans.length} ghost events from ${entry.id} (${orphans.map((e) => e.title).join(", ")})`);

      // Delete cloned copies from target calendars
      const orphanMappings = await prisma.targetEventMapping.findMany({
        where: { sourceEventId: { in: orphanIds } },
        include: { targetCalendar: { include: { source: true } } },
      });

      for (const mapping of orphanMappings) {
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
          console.error(`[sync] Failed to delete orphaned target event ${mapping.targetEventId}:`, err);
        }
      }

      await prisma.targetEventMapping.deleteMany({
        where: { sourceEventId: { in: orphanIds } },
      });
      await prisma.event.deleteMany({
        where: { id: { in: orphanIds } },
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

export async function cloneToTarget(
  prisma: PrismaClient,
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

  console.log(`[sync] cloneToTarget: found ${targetEntries.length} target(s) for user ${userId}`);
  for (const targetEntry of targetEntries) {
    try {
      await cloneToSingleTarget(prisma, userId, targetEntry);
    } catch (err) {
      console.error(`[sync] cloneToSingleTarget failed for target ${targetEntry.id} (${targetEntry.source.provider}):`, err);
    }
  }
}

// Floor backoff applied when an in-run circuit breaker trips on a target write.
// Bumping consecutiveErrors lets the longer adaptive backoff in processSyncJob
// take over on the next run if errors persist.
const TARGET_WRITE_CIRCUIT_BREAKER_MS = 5 * 60_000;
// Permission-denied is a credential/sharing issue, not a transient rate-limit:
// it won't recover in 5 min, so use a longer floor and surface a sticky error.
const TARGET_WRITE_PERMISSION_BREAKER_MS = 60 * 60_000;

type BreakerReason = "rate_limited" | "permission_denied";

function classifyBreakerReason(err: unknown): BreakerReason | null {
  if (!(err instanceof ProviderError)) return null;
  if (err.code === ProviderErrorCode.RATE_LIMITED) return "rate_limited";
  if (err.code === ProviderErrorCode.PERMISSION_DENIED) return "permission_denied";
  return null;
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
    skipIgnored: boolean;
    markAsPrivate: boolean;
    source: { id: string; provider: string; credentials: string };
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

  const targetLabel = `target ${targetEntry.id} (${targetEntry.source.provider}, calendar ${targetEntry.providerCalendarId})`;

  for (const orphan of orphans) {
    try {
      await targetProvider.deleteEvent(
        targetToken,
        targetEntry.providerCalendarId,
        orphan.targetEventId
      );
    } catch (err) {
      console.error(
        `[sync] Failed to delete orphaned target event ${orphan.targetEventId} on ${targetLabel}:`,
        err
      );
    }
  }

  if (orphans.length > 0) {
    await prisma.targetEventMapping.deleteMany({
      where: { id: { in: orphans.map((o: { id: string }) => o.id) } },
    });
    console.log(`[sync] Cleaned up ${orphans.length} orphaned target mappings`);
  }

  // Remove target events for ignored source events (when skipIgnored is enabled)
  if (targetEntry.skipIgnored) {
    const ignoredMappings = await prisma.targetEventMapping.findMany({
      where: {
        targetCalendarEntryId: targetEntry.id,
        sourceEvent: { ignored: true },
      },
      select: { id: true, targetEventId: true },
    });

    for (const mapping of ignoredMappings) {
      try {
        await targetProvider.deleteEvent(
          targetToken,
          targetEntry.providerCalendarId,
          mapping.targetEventId
        );
      } catch (err) {
        console.error(
          `[sync] Failed to delete ignored target event ${mapping.targetEventId} on ${targetLabel}:`,
          err
        );
      }
    }

    if (ignoredMappings.length > 0) {
      await prisma.targetEventMapping.deleteMany({
        where: { id: { in: ignoredMappings.map((m: { id: string }) => m.id) } },
      });
      console.log(`[sync] Removed ${ignoredMappings.length} target events for ignored source events`);
    }
  }

  // Find all local events that don't have a target mapping yet,
  // filtered by the configured sync window
  const syncCutoff = new Date();
  syncCutoff.setDate(syncCutoff.getDate() + targetEntry.syncDaysInAdvance);

  const unmappedEvents = await prisma.event.findMany({
    where: {
      calendarEntry: {
        source: { userId },
        // Exclude only THIS target's own calendar (not other targets used as sources)
        ...(sourceCalendarIds && sourceCalendarIds.length > 0
          ? { id: { in: sourceCalendarIds.filter((id) => id !== targetEntry.id) } }
          : { enabled: true, id: { not: targetEntry.id } }),
      },
      // Loop prevention: skip events that were synced in from another target
      title: { not: { startsWith: "[Sync]" } },
      // Skip events the user has explicitly ignored (when skipIgnored is enabled)
      ...(targetEntry.skipIgnored && { ignored: false }),
      startTime: { lte: syncCutoff },
      sourceMappings: {
        none: { targetCalendarEntryId: targetEntry.id },
      },
    },
  });

  const DAY_MS = 24 * 60 * 60 * 1000;
  const filterReasons: Record<string, number> = {};
  const filteredEvents = unmappedEvents.filter((event) => {
    const meta = event.providerMetadata as Record<string, unknown> | null;
    if (targetEntry.skipWorkLocation && meta?.eventType === "workingLocation") {
      filterReasons["workLocation"] = (filterReasons["workLocation"] || 0) + 1;
      return false;
    }
    if (targetEntry.skipSingleDayAllDay && event.allDay) {
      const duration = new Date(event.endTime).getTime() - new Date(event.startTime).getTime();
      if (duration <= DAY_MS) {
        filterReasons["singleDayAllDay"] = (filterReasons["singleDayAllDay"] || 0) + 1;
        return false;
      }
    }
    if (targetEntry.skipDeclined && meta?.responseStatus === "declined") {
      filterReasons["declined"] = (filterReasons["declined"] || 0) + 1;
      return false;
    }
    if (targetEntry.skipFree) {
      if (meta?.showAs === "free" || meta?.showAs === "tentative" || meta?.transparency === "transparent") {
        filterReasons["free"] = (filterReasons["free"] || 0) + 1;
        return false;
      }
    }
    return true;
  });

  if (Object.keys(filterReasons).length > 0) {
    console.log(`[sync] Target ${targetEntry.id} filter breakdown: ${JSON.stringify(filterReasons)}`);
  }

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
      ...(targetEntry.markAsPrivate && { sensitivity: "private" as const }),
    };
  }

  console.log(`[sync] Target ${targetEntry.id}: ${unmappedEvents.length} unmapped, ${filteredEvents.length} after filter, ${existingMappings.length} existing mappings`);

  let circuitBreakerTripped = false;
  async function tripCircuitBreaker(phase: string, reason: BreakerReason): Promise<void> {
    if (circuitBreakerTripped) return;
    circuitBreakerTripped = true;
    console.warn(
      `[sync] Circuit breaker tripped for ${targetLabel} (${reason}); aborting remaining ${phase} for this run`
    );
    const floorMs =
      reason === "permission_denied"
        ? TARGET_WRITE_PERMISSION_BREAKER_MS
        : TARGET_WRITE_CIRCUIT_BREAKER_MS;
    const minNext = new Date(Date.now() + floorMs);
    const fresh = await prisma.calendarSource.findUnique({
      where: { id: targetEntry.source.id },
      select: { nextSyncAfter: true },
    });
    const existing = fresh?.nextSyncAfter ?? null;
    const nextSyncAfter = existing && existing > minNext ? existing : minNext;
    const data: Record<string, unknown> = {
      nextSyncAfter,
      consecutiveErrors: { increment: 1 },
    };
    if (reason === "permission_denied") {
      // Surface a sticky, user-actionable error. The next successful write or
      // a reauth flow should reset syncStatus/syncError back to ok/null.
      data.syncStatus = "error";
      data.syncError =
        "Target calendar lost write access — please reauthorize the connection or check sharing permissions.";
    }
    await prisma.calendarSource.update({
      where: { id: targetEntry.source.id },
      data,
    });
  }

  for (const event of filteredEvents) {
    if (circuitBreakerTripped) break;
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
      const reason = classifyBreakerReason(err);
      if (reason) {
        await tripCircuitBreaker("create-events loop", reason);
        break;
      }
      console.error(`[sync] Failed to clone event ${event.id} to ${targetLabel}:`, err);
    }
  }

  if (circuitBreakerTripped) return;

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
    let chunkBreakerReason: BreakerReason | null = null;
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
          const reason = classifyBreakerReason(err);
          if (reason) {
            chunkBreakerReason ??= reason;
            return;
          }
          console.error(
            `[sync] Failed to update target event ${mapping.targetEventId} on ${targetLabel}:`,
            err
          );
        }
      })
    );
    if (chunkBreakerReason) {
      await tripCircuitBreaker("stale-update chunks", chunkBreakerReason);
      break;
    }
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

function logSyncHealth(
  prisma: PrismaClient,
  userId: string,
  sourceId: string,
  provider: string,
  syncStart: number,
  eventsProcessed: number,
  eventsFailed: number,
  checksumMatch: boolean
): void {
  const latencyMs = Date.now() - syncStart;
  prisma.syncHealth.create({
    data: { userId, sourceId, provider, eventsProcessed, eventsFailed, latencyMs, checksumMatch },
  }).catch((err) => {
    console.warn("[sync] Failed to log sync health:", err);
  });
}

async function reconcileBookings(prisma: PrismaClient, userId: string): Promise<void> {
  // Find confirmed future bookings that have a provider event ID
  const bookings = await prisma.booking.findMany({
    where: {
      userId,
      status: "confirmed",
      providerEventId: { not: null },
      startTime: { gt: new Date() },
    },
    select: { id: true, providerEventId: true },
  });

  if (bookings.length > 0) {
    // Check which provider event IDs still exist in our events table
    const providerEventIds = bookings.map((b) => b.providerEventId!);
    const existingEvents = await prisma.event.findMany({
      where: { sourceEventId: { in: providerEventIds } },
      select: { sourceEventId: true },
    });
    const existingIds = new Set(existingEvents.map((e) => e.sourceEventId));

    // Cancel bookings whose events no longer exist
    const staleBookingIds = bookings
      .filter((b) => !existingIds.has(b.providerEventId!))
      .map((b) => b.id);

    if (staleBookingIds.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: staleBookingIds } },
        data: { status: "cancelled" },
      });
      console.log(`[sync] Cancelled ${staleBookingIds.length} bookings for user ${userId} (provider events deleted)`);
    }
  }

  // Retry cleanup: delete provider events for cancelled bookings where deletion failed.
  // These have status=cancelled but still a providerEventId (not cleared on successful delete).
  const failedDeletes = await prisma.booking.findMany({
    where: {
      userId,
      status: "cancelled",
      providerEventId: { not: null },
      startTime: { gt: new Date() },
    },
    include: { eventType: { select: { id: true, bookingCalendarEntryId: true } } },
  });

  for (const booking of failedDeletes) {
    try {
      const bookingEntryId = booking.eventType.bookingCalendarEntryId;
      if (!bookingEntryId) continue;

      const entry = await prisma.calendarEntry.findFirst({
        where: { id: bookingEntryId, source: { userId } },
        include: { source: true },
      });
      if (!entry || entry.source.emailForInvitations) continue;

      const provider = getProvider(entry.source.provider);
      const creds = JSON.parse(
        decrypt(entry.source.credentials, process.env.ENCRYPTION_SECRET!)
      );
      const token: TokenSet = {
        accessToken: creds.accessToken || "",
        refreshToken: creds.refreshToken || null,
        expiresAt: creds.expiresAt ? new Date(creds.expiresAt) : null,
      };

      await provider.deleteEvent(token, entry.providerCalendarId, booking.providerEventId!);
      await prisma.booking.update({
        where: { id: booking.id },
        data: { providerEventId: null },
      });
      console.log(`[sync] Retry-deleted provider event for cancelled booking ${booking.id} (${booking.guestName})`);
    } catch (err) {
      console.error(`[sync] Retry-delete failed for booking ${booking.id}:`, err);
    }
  }
}

function parseIcsDate(dateStr: string): Date {
  if (dateStr.length === 8) {
    return new Date(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`);
  }
  const formatted = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}T${dateStr.slice(9, 11)}:${dateStr.slice(11, 13)}:${dateStr.slice(13, 15)}Z`;
  return new Date(formatted);
}

