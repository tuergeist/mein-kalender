import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";
import { syncQueue } from "../queues";

interface AuthenticatedRequest {
  user: AuthUser;
}

export async function syncRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // Trigger sync for a specific source
  app.post<{ Params: { id: string } }>("/api/sources/:id/sync", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const source = await prisma.calendarSource.findFirst({
      where: { id: request.params.id, userId: user.id },
    });

    if (!source) {
      return reply.code(404).send({ error: "Not found" });
    }

    await syncQueue.add(
      "sync-source",
      { sourceId: source.id, userId: user.id },
      { jobId: `sync-${source.id}` }
    );

    return { status: "queued", sourceId: source.id };
  });

  // Force full resync for a source (clears sync token)
  app.post<{ Params: { id: string } }>("/api/sources/:id/full-sync", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const source = await prisma.calendarSource.findFirst({
      where: { id: request.params.id, userId: user.id },
    });

    if (!source) {
      return reply.code(404).send({ error: "Not found" });
    }

    // Clear sync token to force full re-fetch
    await prisma.calendarSource.update({
      where: { id: source.id },
      data: { syncToken: null },
    });

    await syncQueue.add(
      "sync-source",
      { sourceId: source.id, userId: user.id },
      { jobId: `sync-${source.id}-full` }
    );

    return { status: "queued", sourceId: source.id, mode: "full" };
  });

  // Trigger sync for all user's sources
  app.post("/api/sync-all", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const sources = await prisma.calendarSource.findMany({
      where: { userId: user.id },
      select: { id: true },
    });

    await Promise.all(
      sources.map((s: { id: string }) =>
        syncQueue.add(
          "sync-source",
          { sourceId: s.id, userId: user.id },
          { jobId: `sync-${s.id}` }
        )
      )
    );

    return { status: "queued", count: sources.length };
  });
}
