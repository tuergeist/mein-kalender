import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";

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
      },
    });

    return { targetCalendar: targetEntry };
  });

  // Set the target calendar
  app.put<{ Body: { calendarEntryId: string } }>(
    "/api/target-calendar",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { calendarEntryId } = request.body;

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
        data: { isTarget: true },
      });

      return { targetCalendar: updated };
    }
  );

  // Remove target calendar configuration
  app.delete("/api/target-calendar", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;

    await prisma.calendarEntry.updateMany({
      where: {
        source: { userId: user.id },
        isTarget: true,
      },
      data: { isTarget: false },
    });

    return { success: true };
  });
}
