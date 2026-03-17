import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";
import { decrypt } from "../encryption";
import { getProvider } from "../providers";
import { TokenSet } from "../types";

interface AuthenticatedRequest {
  user: AuthUser;
}

export async function targetCalendarRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // Get the user's target calendar configuration
  app.get("/api/target-calendar", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const targetEntry = await prisma.calendarEntry.findFirst({
      where: {
        isTarget: true,
        source: { userId: user.id },
      },
      include: {
        source: { select: { id: true, provider: true, label: true } },
        sourceCalendars: { select: { id: true, name: true } },
      },
    });

    return { targetCalendar: targetEntry };
  });

  // Set the target calendar
  app.put<{ Body: { calendarEntryId: string; syncDaysInAdvance?: number; skipWorkLocation?: boolean; skipSingleDayAllDay?: boolean; skipDeclined?: boolean; skipFree?: boolean; sourceCalendarEntryIds?: string[] } }>(
    "/api/target-calendar",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { calendarEntryId, syncDaysInAdvance, skipWorkLocation, skipSingleDayAllDay, skipDeclined, skipFree, sourceCalendarEntryIds } = request.body;

      const VALID_SYNC_DAYS = [30, 60, 90];
      if (syncDaysInAdvance !== undefined && !VALID_SYNC_DAYS.includes(syncDaysInAdvance)) {
        return reply.code(400).send({ error: "syncDaysInAdvance must be 30, 60, or 90" });
      }

      // Verify the calendar entry belongs to the user and is writable
      const entry = await prisma.calendarEntry.findFirst({
        where: {
          id: calendarEntryId,
          source: { userId: user.id },
        },
      });

      if (!entry) {
        return reply.code(404).send({ error: "Calendar not found" });
      }

      if (entry.readOnly) {
        return reply.code(400).send({ error: "Target calendar must have write access" });
      }

      // Unset any existing target
      await prisma.calendarEntry.updateMany({
        where: {
          source: { userId: user.id },
          isTarget: true,
        },
        data: { isTarget: false },
      });

      // Set the new target
      const updated = await prisma.calendarEntry.update({
        where: { id: calendarEntryId },
        data: {
          isTarget: true,
          syncDaysInAdvance: syncDaysInAdvance ?? 30,
          ...(skipWorkLocation !== undefined && { skipWorkLocation }),
          ...(skipSingleDayAllDay !== undefined && { skipSingleDayAllDay }),
          ...(skipDeclined !== undefined && { skipDeclined }),
          ...(skipFree !== undefined && { skipFree }),
          ...(sourceCalendarEntryIds !== undefined && {
            sourceCalendars: { set: sourceCalendarEntryIds.map((id) => ({ id })) },
          }),
        },
      });

      return { targetCalendar: updated };
    }
  );

  // Remove target calendar configuration
  app.delete<{
    Querystring: { deleteSyncedEvents?: string };
  }>("/api/target-calendar", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const deleteSyncedEvents = request.query.deleteSyncedEvents === "true";

    const targetEntry = await prisma.calendarEntry.findFirst({
      where: { isTarget: true, source: { userId: user.id } },
      include: { source: true },
    });

    let deletedCount = 0;

    if (targetEntry && deleteSyncedEvents) {
      // Get all target mappings to delete from provider
      const mappings = await prisma.targetEventMapping.findMany({
        where: { targetCalendarEntryId: targetEntry.id },
      });

      if (mappings.length > 0) {
        try {
          const targetProvider = getProvider(targetEntry.source.provider);
          const creds = JSON.parse(
            decrypt(targetEntry.source.credentials, process.env.ENCRYPTION_SECRET!)
          );
          const targetToken: TokenSet = {
            accessToken: creds.accessToken || "",
            refreshToken: creds.refreshToken || null,
            expiresAt: creds.expiresAt ? new Date(creds.expiresAt) : null,
          };

          // Delete in batches of 4 with 1s delay to avoid rate limits
          const BATCH_SIZE = 4;
          for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
            const batch = mappings.slice(i, i + BATCH_SIZE);
            await Promise.all(
              batch.map(async (mapping: any) => {
                try {
                  await targetProvider.deleteEvent(
                    targetToken,
                    targetEntry.providerCalendarId,
                    mapping.targetEventId
                  );
                  deletedCount++;
                } catch (err) {
                  console.error(`[target] Failed to delete synced event ${mapping.targetEventId}:`, err);
                }
              })
            );
            if (i + BATCH_SIZE < mappings.length) {
              await new Promise((r) => setTimeout(r, 1000));
            }
          }
        } catch (err) {
          console.error("[target] Failed to connect to target provider for cleanup:", err);
        }

        // Remove all mappings regardless of provider delete success
        await prisma.targetEventMapping.deleteMany({
          where: { targetCalendarEntryId: targetEntry.id },
        });
      }
    }

    // Unset target flag
    await prisma.calendarEntry.updateMany({
      where: {
        source: { userId: user.id },
        isTarget: true,
      },
      data: { isTarget: false },
    });

    return { success: true, deletedEvents: deletedCount };
  });

  // Clean up all [Sync] events from a calendar on the provider side
  app.post<{
    Body: { calendarEntryId?: string };
  }>("/api/target-calendar/cleanup", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;

    // Use provided calendarEntryId or find current target
    const where = request.body?.calendarEntryId
      ? { id: request.body.calendarEntryId, source: { userId: user.id } }
      : { isTarget: true, source: { userId: user.id } };

    const targetEntry = await prisma.calendarEntry.findFirst({
      where,
      include: { source: true },
    });

    if (!targetEntry) {
      return reply.code(400).send({ error: "Calendar not found" });
    }

    const targetProvider = getProvider(targetEntry.source.provider);
    const creds = JSON.parse(
      decrypt(targetEntry.source.credentials, process.env.ENCRYPTION_SECRET!)
    );
    const targetToken: TokenSet = {
      accessToken: creds.accessToken || "",
      refreshToken: creds.refreshToken || null,
      expiresAt: creds.expiresAt ? new Date(creds.expiresAt) : null,
    };

    // Fetch all events from the target calendar
    const delta = await targetProvider.getEvents(
      targetToken,
      targetEntry.providerCalendarId,
      null
    );

    const syncEvents = delta.created.filter(
      (e) => e.title.startsWith("[Sync] ")
    );

    console.log(`[target-cleanup] Found ${syncEvents.length} [Sync] events to delete`);

    let deletedCount = 0;
    const BATCH_SIZE = 4;

    for (let i = 0; i < syncEvents.length; i += BATCH_SIZE) {
      const batch = syncEvents.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (event) => {
          try {
            await targetProvider.deleteEvent(
              targetToken,
              targetEntry.providerCalendarId,
              event.sourceEventId
            );
            deletedCount++;
          } catch (err) {
            console.error(`[target-cleanup] Failed to delete ${event.sourceEventId}:`, err);
          }
        })
      );
      if (i + BATCH_SIZE < syncEvents.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // Also clean up DB mappings for deleted events
    await prisma.targetEventMapping.deleteMany({
      where: { targetCalendarEntryId: targetEntry.id },
    });

    return {
      found: syncEvents.length,
      deleted: deletedCount,
      failed: syncEvents.length - deletedCount,
    };
  });
}
