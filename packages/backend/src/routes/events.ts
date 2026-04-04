import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";
import { conflictQueue } from "../queues";

interface AuthenticatedRequest {
  user: AuthUser;
}

export async function eventsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // List events by date range
  app.get<{
    Querystring: { start: string; end: string; calendarEntryId?: string };
  }>("/api/events", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const { start, end, calendarEntryId } = request.query;

    const where: Record<string, unknown> = {
      startTime: { lte: new Date(end) },
      endTime: { gte: new Date(start) },
      calendarEntry: {
        source: { userId: user.id },
        enabled: true,
      },
    };

    if (calendarEntryId) {
      where.calendarEntryId = calendarEntryId;
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        calendarEntry: {
          select: { id: true, name: true, color: true, userColor: true, readOnly: true, sourceId: true },
        },
      },
      orderBy: { startTime: "asc" },
    });

    return events;
  });

  // Update an event (propagates to source via sync engine)
  app.put<{
    Params: { id: string };
    Body: {
      title?: string;
      description?: string;
      location?: string;
      startTime?: string;
      endTime?: string;
      allDay?: boolean;
    };
  }>("/api/events/:id", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const event = await prisma.event.findFirst({
      where: {
        id: request.params.id,
        calendarEntry: { source: { userId: user.id } },
      },
      include: {
        calendarEntry: { select: { readOnly: true } },
      },
    });

    if (!event) {
      return reply.code(404).send({ error: "Not found" });
    }

    if (event.calendarEntry.readOnly) {
      return reply.code(403).send({ error: "Calendar is read-only" });
    }

    const { title, description, location, startTime, endTime, allDay } = request.body;

    const updated = await prisma.event.update({
      where: { id: request.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(location !== undefined && { location }),
        ...(startTime !== undefined && { startTime: new Date(startTime) }),
        ...(endTime !== undefined && { endTime: new Date(endTime) }),
        ...(allDay !== undefined && { allDay }),
      },
    });

    // TODO: Enqueue job to propagate edit to source provider (task 9.7/14.4)

    return updated;
  });

  // Toggle ignored status on a single event
  app.put<{
    Params: { id: string };
    Body: { ignored: boolean };
  }>("/api/events/:id/ignore", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const event = await prisma.event.findFirst({
      where: {
        id: request.params.id,
        calendarEntry: { source: { userId: user.id } },
      },
    });

    if (!event) {
      return reply.code(404).send({ error: "Not found" });
    }

    const updated = await prisma.event.update({
      where: { id: request.params.id },
      data: { ignored: request.body.ignored },
    });

    conflictQueue.add("detect-conflicts", { userId: user.id }, {
      jobId: `conflicts-${user.id}-ignore-${Date.now()}`,
      removeOnComplete: 50,
      removeOnFail: 20,
    }).catch(() => {});

    return updated;
  });

  // Ignore/unignore all events in a series (same title + same calendar)
  app.put<{
    Body: { eventId: string; ignored: boolean };
  }>("/api/events/ignore-series", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const { eventId, ignored } = request.body;

    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        calendarEntry: { source: { userId: user.id } },
      },
    });

    if (!event) {
      return reply.code(404).send({ error: "Not found" });
    }

    const result = await prisma.event.updateMany({
      where: {
        calendarEntryId: event.calendarEntryId,
        title: event.title,
      },
      data: { ignored },
    });

    conflictQueue.add("detect-conflicts", { userId: user.id }, {
      jobId: `conflicts-${user.id}-ignore-${Date.now()}`,
      removeOnComplete: 50,
      removeOnFail: 20,
    }).catch(() => {});

    return { count: result.count };
  });

  // Delete an event
  app.delete<{ Params: { id: string } }>("/api/events/:id", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const event = await prisma.event.findFirst({
      where: {
        id: request.params.id,
        calendarEntry: { source: { userId: user.id } },
      },
      include: {
        calendarEntry: { select: { readOnly: true } },
      },
    });

    if (!event) {
      return reply.code(404).send({ error: "Not found" });
    }

    if (event.calendarEntry.readOnly) {
      return reply.code(403).send({ error: "Calendar is read-only" });
    }

    await prisma.event.delete({ where: { id: request.params.id } });

    // TODO: Enqueue job to propagate delete to source provider

    return { success: true };
  });
}
