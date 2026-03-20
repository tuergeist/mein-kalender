import { FastifyInstance } from "fastify";
import { randomBytes } from "crypto";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";

interface AuthenticatedRequest {
  user: AuthUser;
}

function generateToken(): string {
  return randomBytes(24).toString("base64url").slice(0, 32);
}

export async function icsFeedsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // List feeds
  app.get("/api/ics-feeds", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const feeds = await prisma.icsFeed.findMany({
      where: { userId: user.id },
      include: { calendars: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return feeds;
  });

  // Create feed
  app.post<{ Body: { name: string; mode?: string; daysInAdvance?: number; calendarEntryIds?: string[] } }>(
    "/api/ics-feeds",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { name, mode, daysInAdvance, calendarEntryIds } = request.body;

      if (!name) return reply.code(400).send({ error: "name is required" });

      const VALID_MODES = ["full", "freebusy"];
      if (mode && !VALID_MODES.includes(mode)) {
        return reply.code(400).send({ error: "mode must be 'full' or 'freebusy'" });
      }

      const token = generateToken();

      const feed = await prisma.icsFeed.create({
        data: {
          userId: user.id,
          name,
          token,
          mode: mode || "full",
          daysInAdvance: daysInAdvance || 30,
          ...(calendarEntryIds && calendarEntryIds.length > 0 && {
            calendars: { connect: calendarEntryIds.map((id) => ({ id })) },
          }),
        },
        include: { calendars: { select: { id: true, name: true } } },
      });

      return reply.code(201).send(feed);
    }
  );

  // Update feed
  app.put<{ Params: { id: string }; Body: { name?: string; mode?: string; daysInAdvance?: number; calendarEntryIds?: string[] } }>(
    "/api/ics-feeds/:id",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { id } = request.params;
      const { name, mode, daysInAdvance, calendarEntryIds } = request.body;

      const existing = await prisma.icsFeed.findFirst({ where: { id, userId: user.id } });
      if (!existing) return reply.code(404).send({ error: "Feed not found" });

      const updated = await prisma.icsFeed.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(mode !== undefined && { mode }),
          ...(daysInAdvance !== undefined && { daysInAdvance }),
          ...(calendarEntryIds !== undefined && {
            calendars: { set: calendarEntryIds.map((cid) => ({ id: cid })) },
          }),
        },
        include: { calendars: { select: { id: true, name: true } } },
      });

      return updated;
    }
  );

  // Delete feed
  app.delete<{ Params: { id: string } }>(
    "/api/ics-feeds/:id",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { id } = request.params;

      const existing = await prisma.icsFeed.findFirst({ where: { id, userId: user.id } });
      if (!existing) return reply.code(404).send({ error: "Feed not found" });

      await prisma.icsFeed.delete({ where: { id } });
      return { success: true };
    }
  );
}
