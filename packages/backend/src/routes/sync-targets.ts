import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";
import { decrypt } from "../encryption";
import { getProvider } from "../providers";
import { TokenSet } from "../types";

interface AuthenticatedRequest {
  user: AuthUser;
}

export async function syncTargetsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // List all sync targets
  app.get("/api/sync-targets", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const targets = await prisma.calendarEntry.findMany({
      where: {
        isTarget: true,
        source: { userId: user.id },
      },
      include: {
        source: { select: { id: true, provider: true, label: true } },
        sourceCalendars: { select: { id: true, name: true } },
      },
    });

    return { targets };
  });

  // Create a new sync target
  app.post<{
    Body: {
      calendarEntryId: string;
      syncMode?: string;
      syncDaysInAdvance?: number;
      skipWorkLocation?: boolean;
      skipSingleDayAllDay?: boolean;
      skipDeclined?: boolean;
      skipFree?: boolean;
      skipIgnored?: boolean;
      markAsPrivate?: boolean;
      sourceCalendarEntryIds?: string[];
    };
  }>("/api/sync-targets", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const { calendarEntryId, syncMode, syncDaysInAdvance, skipWorkLocation, skipSingleDayAllDay, skipDeclined, skipFree, skipIgnored, markAsPrivate, sourceCalendarEntryIds } = request.body;

    const entry = await prisma.calendarEntry.findFirst({
      where: { id: calendarEntryId, source: { userId: user.id } },
    });

    if (!entry) return reply.code(404).send({ error: "Calendar not found" });
    if (entry.readOnly) return reply.code(400).send({ error: "Target calendar must have write access" });
    if (entry.isTarget) return reply.code(409).send({ error: "This calendar is already a sync target" });

    if (syncMode && syncMode !== "full" && syncMode !== "blocked") {
      return reply.code(400).send({ error: "syncMode must be 'full' or 'blocked'" });
    }

    const updated = await prisma.calendarEntry.update({
      where: { id: calendarEntryId },
      data: {
        isTarget: true,
        syncMode: syncMode || "full",
        ...(syncDaysInAdvance !== undefined && { syncDaysInAdvance }),
        ...(skipWorkLocation !== undefined && { skipWorkLocation }),
        ...(skipSingleDayAllDay !== undefined && { skipSingleDayAllDay }),
        ...(skipDeclined !== undefined && { skipDeclined }),
        ...(skipFree !== undefined && { skipFree }),
        ...(skipIgnored !== undefined && { skipIgnored }),
        ...(markAsPrivate !== undefined && { markAsPrivate }),
        ...(sourceCalendarEntryIds !== undefined && {
          sourceCalendars: { set: sourceCalendarEntryIds.map((id) => ({ id })) },
        }),
      },
      include: {
        source: { select: { id: true, provider: true, label: true } },
        sourceCalendars: { select: { id: true, name: true } },
      },
    });

    return reply.code(201).send({ target: updated });
  });

  // Update a sync target
  app.put<{
    Params: { id: string };
    Body: {
      syncMode?: string;
      syncDaysInAdvance?: number;
      skipWorkLocation?: boolean;
      skipSingleDayAllDay?: boolean;
      skipDeclined?: boolean;
      skipFree?: boolean;
      skipIgnored?: boolean;
      markAsPrivate?: boolean;
      sourceCalendarEntryIds?: string[];
    };
  }>("/api/sync-targets/:id", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const { id } = request.params;
    const { syncMode, syncDaysInAdvance, skipWorkLocation, skipSingleDayAllDay, skipDeclined, skipFree, skipIgnored, markAsPrivate, sourceCalendarEntryIds } = request.body;

    const entry = await prisma.calendarEntry.findFirst({
      where: { id, isTarget: true, source: { userId: user.id } },
    });

    if (!entry) return reply.code(404).send({ error: "Sync target not found" });

    if (syncMode && syncMode !== "full" && syncMode !== "blocked") {
      return reply.code(400).send({ error: "syncMode must be 'full' or 'blocked'" });
    }

    const updated = await prisma.calendarEntry.update({
      where: { id },
      data: {
        ...(syncMode !== undefined && { syncMode }),
        ...(syncDaysInAdvance !== undefined && { syncDaysInAdvance }),
        ...(skipWorkLocation !== undefined && { skipWorkLocation }),
        ...(skipSingleDayAllDay !== undefined && { skipSingleDayAllDay }),
        ...(skipDeclined !== undefined && { skipDeclined }),
        ...(skipFree !== undefined && { skipFree }),
        ...(skipIgnored !== undefined && { skipIgnored }),
        ...(markAsPrivate !== undefined && { markAsPrivate }),
        ...(sourceCalendarEntryIds !== undefined && {
          sourceCalendars: { set: sourceCalendarEntryIds.map((cid) => ({ id: cid })) },
        }),
      },
      include: {
        source: { select: { id: true, provider: true, label: true } },
        sourceCalendars: { select: { id: true, name: true } },
      },
    });

    return { target: updated };
  });

  // Delete a sync target
  app.delete<{
    Params: { id: string };
    Querystring: { deleteSyncedEvents?: string };
  }>("/api/sync-targets/:id", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const { id } = request.params;
    const deleteSyncedEvents = request.query.deleteSyncedEvents === "true";

    const entry = await prisma.calendarEntry.findFirst({
      where: { id, isTarget: true, source: { userId: user.id } },
      include: { source: true },
    });

    if (!entry) return reply.code(404).send({ error: "Sync target not found" });

    let deletedCount = 0;

    if (deleteSyncedEvents) {
      const mappings = await prisma.targetEventMapping.findMany({
        where: { targetCalendarEntryId: id },
      });

      if (mappings.length > 0) {
        try {
          const targetProvider = getProvider(entry.source.provider);
          const creds = JSON.parse(decrypt(entry.source.credentials, process.env.ENCRYPTION_SECRET!));
          const targetToken: TokenSet = {
            accessToken: creds.accessToken || "",
            refreshToken: creds.refreshToken || null,
            expiresAt: creds.expiresAt ? new Date(creds.expiresAt) : null,
          };

          const BATCH_SIZE = 4;
          for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
            const batch = mappings.slice(i, i + BATCH_SIZE);
            await Promise.all(
              batch.map(async (mapping: any) => {
                try {
                  await targetProvider.deleteEvent(targetToken, entry.providerCalendarId, mapping.targetEventId);
                  deletedCount++;
                } catch (err) {
                  console.error(`[sync-targets] Failed to delete synced event ${mapping.targetEventId}:`, err);
                }
              })
            );
            if (i + BATCH_SIZE < mappings.length) {
              await new Promise((r) => setTimeout(r, 1000));
            }
          }
        } catch (err) {
          console.error("[sync-targets] Failed to connect to target provider for cleanup:", err);
        }
      }

      await prisma.targetEventMapping.deleteMany({
        where: { targetCalendarEntryId: id },
      });
    }

    await prisma.calendarEntry.update({
      where: { id },
      data: {
        isTarget: false,
        syncMode: "full",
        sourceCalendars: { set: [] },
      },
    });

    return { success: true, deletedEvents: deletedCount };
  });
}
