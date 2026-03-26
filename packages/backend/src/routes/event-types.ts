import { FastifyInstance } from "fastify";
import { randomBytes } from "crypto";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";
import { computeSlotsForPreview } from "./public-booking";

async function generateShortHash(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const hash = randomBytes(4).readUInt32BE(0).toString(36).slice(0, 5).padStart(5, "0");
    const existing = await prisma.eventType.findUnique({ where: { shortHash: hash } });
    if (!existing) return hash;
  }
  throw new Error("Failed to generate unique short hash");
}

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
      include: {
        calendars: { select: { id: true, name: true } },
        availabilityRules: { orderBy: { dayOfWeek: "asc" } },
      },
    });
    return eventTypes;
  });

  // Get single event type
  app.get<{ Params: { id: string } }>(
    "/api/event-types/:id",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { id } = request.params;
      const eventType = await prisma.eventType.findFirst({
        where: { id, userId: user.id },
        include: {
          calendars: { select: { id: true, name: true } },
          availabilityRules: { orderBy: { dayOfWeek: "asc" } },
        },
      });
      if (!eventType) return reply.code(404).send({ error: "Event type not found" });
      return eventType;
    }
  );

  // Create event type
  app.post<{ Body: { name: string; durationMinutes: number; description?: string; location?: string; color?: string; redirectUrl?: string; redirectTitle?: string; redirectDelaySecs?: number; bookingCalendarEntryId?: string } }>(
    "/api/event-types",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { name, durationMinutes, description, location, color, redirectUrl, redirectTitle, redirectDelaySecs, bookingCalendarEntryId } = request.body;

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
          bookingCalendarEntryId: bookingCalendarEntryId || null,
        },
      });

      return reply.code(201).send(eventType);
    }
  );

  // Update event type
  app.put<{ Params: { id: string }; Body: { name?: string; durationMinutes?: number; description?: string; location?: string; color?: string; enabled?: boolean; redirectUrl?: string; redirectTitle?: string; redirectDelaySecs?: number; calendarEntryIds?: string[]; bookingCalendarEntryId?: string | null; availabilityRules?: Array<{ dayOfWeek: number; startTime: string; endTime: string; enabled: boolean }>; enableShortLink?: boolean; brandColor?: string | null; accentColor?: string | null; avatarUrl?: string | null; backgroundUrl?: string | null; backgroundOpacity?: number | null } }>(
    "/api/event-types/:id",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { id } = request.params;
      const { name, durationMinutes, description, location, color, enabled, redirectUrl, redirectTitle, redirectDelaySecs, calendarEntryIds, bookingCalendarEntryId, availabilityRules, enableShortLink, brandColor, accentColor, avatarUrl, backgroundUrl, backgroundOpacity } = request.body;

      const existing = await prisma.eventType.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) {
        return reply.code(404).send({ error: "Event type not found" });
      }

      // Handle short link toggle
      let shortHashUpdate: { shortHash: string | null } | undefined;
      if (enableShortLink === true && !existing.shortHash) {
        shortHashUpdate = { shortHash: await generateShortHash() };
      } else if (enableShortLink === false && existing.shortHash) {
        shortHashUpdate = { shortHash: null };
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
          ...(calendarEntryIds !== undefined && {
            calendars: { set: calendarEntryIds.map((cid) => ({ id: cid })) },
          }),
          ...(bookingCalendarEntryId !== undefined && { bookingCalendarEntryId: bookingCalendarEntryId || null }),
          ...(shortHashUpdate && shortHashUpdate),
          ...(brandColor !== undefined && { brandColor: brandColor || null }),
          ...(accentColor !== undefined && { accentColor: accentColor || null }),
          ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
          ...(backgroundUrl !== undefined && { backgroundUrl: backgroundUrl || null }),
          ...(backgroundOpacity !== undefined && { backgroundOpacity }),
        },
      });

      // Upsert per-type availability rules if provided
      if (availabilityRules !== undefined) {
        await Promise.all(
          availabilityRules.map((rule) =>
            prisma.availabilityRule.upsert({
              where: { userId_eventTypeId_dayOfWeek: { userId: user.id, eventTypeId: id, dayOfWeek: rule.dayOfWeek } },
              create: { userId: user.id, eventTypeId: id, dayOfWeek: rule.dayOfWeek, startTime: rule.startTime, endTime: rule.endTime, enabled: rule.enabled },
              update: { startTime: rule.startTime, endTime: rule.endTime, enabled: rule.enabled },
            })
          )
        );
      }

      return updated;
    }
  );

  // Availability preview
  app.get<{ Params: { id: string }; Querystring: { week?: string } }>(
    "/api/event-types/:id/availability-preview",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { id } = request.params;
      const weekStart = request.query.week || new Date().toISOString().slice(0, 10);

      const eventType = await prisma.eventType.findFirst({
        where: { id, userId: user.id },
        include: { calendars: { select: { id: true } } },
      });
      if (!eventType) return reply.code(404).send({ error: "Event type not found" });

      const calendarIds = eventType.calendars.map((c) => c.id);
      const days = [];

      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart + "T00:00:00Z");
        date.setUTCDate(date.getUTCDate() + i);
        const dateStr = date.toISOString().slice(0, 10);
        const dayOfWeek = date.getUTCDay();

        // Load working hours (per-type first, then default)
        let rule = await prisma.availabilityRule.findUnique({
          where: { userId_eventTypeId_dayOfWeek: { userId: user.id, eventTypeId: id, dayOfWeek } },
        });
        if (!rule) {
          rule = await prisma.availabilityRule.findFirst({
            where: { userId: user.id, eventTypeId: null, dayOfWeek },
          });
        }

        const workingHours = rule
          ? { start: rule.startTime, end: rule.endTime, enabled: rule.enabled }
          : { start: "09:00", end: "17:00", enabled: false };

        if (!workingHours.enabled) {
          days.push({ date: dateStr, workingHours, busyBlocks: [], bookings: [], availableSlots: [] });
          continue;
        }

        const [startH, startM] = workingHours.start.split(":").map(Number);
        const [endH, endM] = workingHours.end.split(":").map(Number);
        const dayStart = new Date(date); dayStart.setUTCHours(startH, startM, 0, 0);
        const dayEnd = new Date(date); dayEnd.setUTCHours(endH, endM, 0, 0);

        // Busy events
        const events = await prisma.event.findMany({
          where: {
            startTime: { lt: dayEnd },
            endTime: { gt: dayStart },
            calendarEntry: {
              source: { userId: user.id },
              ...(calendarIds.length > 0 ? { id: { in: calendarIds } } : { enabled: true }),
            },
          },
          select: { startTime: true, endTime: true, title: true, providerMetadata: true, calendarEntry: { select: { name: true, color: true } } },
        });

        const busyBlocks = events
          .filter((e) => {
            const meta = e.providerMetadata as Record<string, unknown> | null;
            return meta?.showAs !== "free" && meta?.transparency !== "transparent" && meta?.eventType !== "workingLocation";
          })
          .map((e) => ({
            start: e.startTime.toISOString(),
            end: e.endTime.toISOString(),
            title: e.title,
            calendar: e.calendarEntry.name,
            color: e.calendarEntry.color,
          }));

        // Existing bookings
        const bookingsList = await prisma.booking.findMany({
          where: { userId: user.id, status: "confirmed", startTime: { lt: dayEnd }, endTime: { gt: dayStart } },
          select: { startTime: true, endTime: true, guestName: true },
        });

        const bookings = bookingsList.map((b) => ({
          start: b.startTime.toISOString(),
          end: b.endTime.toISOString(),
          guestName: b.guestName,
        }));

        // Available slots (reuse logic from computeSlots)
        const availableSlots = await computeSlotsForPreview(user.id, eventType.durationMinutes, dateStr, calendarIds, id);

        days.push({ date: dateStr, workingHours, busyBlocks, bookings, availableSlots });
      }

      return { days };
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
