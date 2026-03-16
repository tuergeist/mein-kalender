import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";

interface AuthenticatedRequest {
  user: AuthUser;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function eventTypesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // List event types
  app.get("/api/event-types", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const eventTypes = await prisma.eventType.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    return eventTypes;
  });

  // Create event type
  app.post<{ Body: { name: string; durationMinutes: number; description?: string; location?: string; color?: string; redirectUrl?: string; redirectTitle?: string; redirectDelaySecs?: number } }>(
    "/api/event-types",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { name, durationMinutes, description, location, color, redirectUrl, redirectTitle, redirectDelaySecs } = request.body;

      if (!name || !durationMinutes) {
        return reply.code(400).send({ error: "name and durationMinutes are required" });
      }

      // Generate unique slug
      let slug = slugify(name);
      if (!slug) slug = "event";
      const existing = await prisma.eventType.findMany({
        where: { userId: user.id, slug: { startsWith: slug } },
        select: { slug: true },
      });
      const existingSlugs = new Set(existing.map((e) => e.slug));
      if (existingSlugs.has(slug)) {
        let i = 2;
        while (existingSlugs.has(`${slug}-${i}`)) i++;
        slug = `${slug}-${i}`;
      }

      const eventType = await prisma.eventType.create({
        data: {
          userId: user.id,
          slug,
          name,
          durationMinutes,
          description: description || null,
          location: location || null,
          color: color || "#3b82f6",
          redirectUrl: redirectUrl || null,
          redirectTitle: redirectTitle || null,
          ...(redirectDelaySecs !== undefined && { redirectDelaySecs }),
        },
      });

      return reply.code(201).send(eventType);
    }
  );

  // Update event type
  app.put<{ Params: { id: string }; Body: { name?: string; durationMinutes?: number; description?: string; location?: string; color?: string; enabled?: boolean; redirectUrl?: string; redirectTitle?: string; redirectDelaySecs?: number } }>(
    "/api/event-types/:id",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { id } = request.params;
      const { name, durationMinutes, description, location, color, enabled, redirectUrl, redirectTitle, redirectDelaySecs } = request.body;

      const existing = await prisma.eventType.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) {
        return reply.code(404).send({ error: "Event type not found" });
      }

      const updated = await prisma.eventType.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(durationMinutes !== undefined && { durationMinutes }),
          ...(description !== undefined && { description }),
          ...(location !== undefined && { location }),
          ...(color !== undefined && { color }),
          ...(redirectUrl !== undefined && { redirectUrl: redirectUrl || null }),
          ...(redirectTitle !== undefined && { redirectTitle: redirectTitle || null }),
          ...(redirectDelaySecs !== undefined && { redirectDelaySecs }),
          ...(enabled !== undefined && { enabled }),
        },
      });

      return updated;
    }
  );

  // Delete event type
  app.delete<{ Params: { id: string } }>(
    "/api/event-types/:id",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { id } = request.params;

      const existing = await prisma.eventType.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) {
        return reply.code(404).send({ error: "Event type not found" });
      }

      await prisma.eventType.delete({ where: { id } });
      return { success: true };
    }
  );
}
