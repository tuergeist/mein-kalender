import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { decrypt } from "../encryption";
import { getProvider } from "../providers";
import { TokenSet } from "../types";

interface SlotParams {
  username: string;
  slug: string;
}

export async function publicBookingRoutes(app: FastifyInstance) {
  // NO auth middleware — these are public routes

  // Get event type info
  app.get<{ Params: SlotParams }>(
    "/api/public/book/:username/:slug",
    async (request, reply) => {
      const { username, slug } = request.params;

      const user = await prisma.user.findUnique({
        where: { username },
        select: { id: true, email: true, username: true, displayName: true, avatarUrl: true, brandColor: true, accentColor: true, backgroundUrl: true, backgroundOpacity: true },
      });
      if (!user) return reply.code(404).send({ error: "Not found" });

      const eventType = await prisma.eventType.findFirst({
        where: { userId: user.id, slug },
        select: { id: true, name: true, slug: true, durationMinutes: true, description: true, location: true, color: true, enabled: true, redirectUrl: true, redirectTitle: true, redirectDelaySecs: true, brandColor: true, accentColor: true, avatarUrl: true, backgroundUrl: true, backgroundOpacity: true },
      });

      if (!eventType || !eventType.enabled) {
        return reply.code(404).send({ error: "Event type not available" });
      }

      return {
        eventType: { id: eventType.id, name: eventType.name, slug: eventType.slug, durationMinutes: eventType.durationMinutes, description: eventType.description, location: eventType.location, color: eventType.color, enabled: eventType.enabled, redirectUrl: eventType.redirectUrl, redirectTitle: eventType.redirectTitle, redirectDelaySecs: eventType.redirectDelaySecs },
        host: { displayName: user.displayName || user.email, username: user.username },
        branding: {
          brandColor: eventType.brandColor || user.brandColor || null,
          accentColor: eventType.accentColor || user.accentColor || null,
          avatarUrl: eventType.avatarUrl || user.avatarUrl || null,
          backgroundUrl: eventType.backgroundUrl || user.backgroundUrl || null,
          backgroundOpacity: eventType.backgroundOpacity ?? user.backgroundOpacity ?? null,
        },
      };
    }
  );

  // Get which days in a month have at least one available slot
  app.get<{ Params: SlotParams; Querystring: { month: string } }>(
    "/api/public/book/:username/:slug/available-days",
    async (request, reply) => {
      const { username, slug } = request.params;
      const { month } = request.query;

      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return reply.code(400).send({ error: "month query param required (YYYY-MM)" });
      }

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) return reply.code(404).send({ error: "Not found" });

      const eventType = await prisma.eventType.findFirst({
        where: { userId: user.id, slug, enabled: true },
        include: { calendars: { select: { id: true } }, availabilityRules: true },
      });
      if (!eventType) return reply.code(404).send({ error: "Event type not available" });

      const calendarIds = eventType.calendars.map((c) => c.id);
      const [year, mon] = month.split("-").map(Number);
      const daysInMonth = new Date(year, mon, 0).getDate();
      const availableDays: string[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const slots = await computeSlots(user.id, eventType.durationMinutes, dateStr, calendarIds, eventType.id);
        if (slots.length > 0) availableDays.push(dateStr);
      }

      return { month, availableDays };
    }
  );

  // Get available slots for a date
  app.get<{ Params: SlotParams; Querystring: { date: string } }>(
    "/api/public/book/:username/:slug/slots",
    async (request, reply) => {
      const { username, slug } = request.params;
      const { date } = request.query;

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return reply.code(400).send({ error: "date query param required (YYYY-MM-DD)" });
      }

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) return reply.code(404).send({ error: "Not found" });

      const eventType = await prisma.eventType.findFirst({
        where: { userId: user.id, slug, enabled: true },
        include: { calendars: { select: { id: true } }, availabilityRules: true },
      });
      if (!eventType) return reply.code(404).send({ error: "Event type not available" });

      const calendarIds = eventType.calendars.map((c) => c.id);
      const slots = await computeSlots(user.id, eventType.durationMinutes, date, calendarIds, eventType.id);
      return { date, slots };
    }
  );

  // Create a booking
  app.post<{ Params: SlotParams; Body: { startTime: string; guestName: string; guestEmail: string; notes?: string } }>(
    "/api/public/book/:username/:slug",
    async (request, reply) => {
      const { username, slug } = request.params;
      const { startTime, guestName, guestEmail, notes } = request.body;

      if (!guestName || !guestEmail || !startTime) {
        return reply.code(400).send({ error: "guestName, guestEmail, and startTime are required" });
      }

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) return reply.code(404).send({ error: "Not found" });

      const eventType = await prisma.eventType.findFirst({
        where: { userId: user.id, slug, enabled: true },
        include: { calendars: { select: { id: true } }, availabilityRules: true },
      });
      if (!eventType) return reply.code(404).send({ error: "Event type not available" });

      const start = new Date(startTime);
      const end = new Date(start.getTime() + eventType.durationMinutes * 60 * 1000);
      const dateStr = start.toISOString().slice(0, 10);

      // Re-check availability to prevent double-booking
      const calendarIds = eventType.calendars.map((c) => c.id);
      const slots = await computeSlots(user.id, eventType.durationMinutes, dateStr, calendarIds, eventType.id);
      const slotAvailable = slots.some((s) => new Date(s).getTime() === start.getTime());
      if (!slotAvailable) {
        return reply.code(409).send({ error: "This slot is no longer available" });
      }

      // Create calendar event on host's booking calendar (or target, or first writable)
      let providerEventId: string | null = null;
      try {
        let bookingEntry = null;

        // 1. Try event-type-specific booking calendar
        if (eventType.bookingCalendarEntryId) {
          bookingEntry = await prisma.calendarEntry.findFirst({
            where: { id: eventType.bookingCalendarEntryId, source: { userId: user.id } },
            include: { source: true },
          });
        }

        // 2. Try user's global booking calendar
        if (!bookingEntry && user.bookingCalendarEntryId) {
          bookingEntry = await prisma.calendarEntry.findFirst({
            where: { id: user.bookingCalendarEntryId, source: { userId: user.id } },
            include: { source: true },
          });
        }

        // 3. Fall back to target calendar, then first writable
        if (!bookingEntry) {
          bookingEntry = await prisma.calendarEntry.findFirst({
            where: {
              source: { userId: user.id },
              OR: [{ isTarget: true }, { readOnly: false }],
            },
            include: { source: true },
            orderBy: { isTarget: "desc" },
          });
        }

        if (bookingEntry) {
          const provider = getProvider(bookingEntry.source.provider);
          const creds = JSON.parse(
            decrypt(bookingEntry.source.credentials, process.env.ENCRYPTION_SECRET!)
          );
          const token: TokenSet = {
            accessToken: creds.accessToken || "",
            refreshToken: creds.refreshToken || null,
            expiresAt: creds.expiresAt ? new Date(creds.expiresAt) : null,
          };

          const calEvent = await provider.createEvent(token, bookingEntry.providerCalendarId, {
            title: `[Booking] ${guestName} — ${eventType.name}`,
            description: `Guest: ${guestName} <${guestEmail}>${notes ? `\nNotes: ${notes}` : ""}`,
            location: eventType.location,
            startTime: start,
            endTime: end,
            allDay: false,
            attendees: [{ email: guestEmail, name: guestName }],
          });
          providerEventId = calEvent.sourceEventId;
        }
      } catch (err) {
        console.error("[booking] Failed to create calendar event:", err);
      }

      const booking = await prisma.booking.create({
        data: {
          eventTypeId: eventType.id,
          userId: user.id,
          guestName,
          guestEmail,
          notes: notes || null,
          startTime: start,
          endTime: end,
          providerEventId,
        },
      });

      return reply.code(201).send({
        booking: {
          id: booking.id,
          startTime: booking.startTime,
          endTime: booking.endTime,
          eventTypeName: eventType.name,
          hostName: user.displayName || user.email,
        },
      });
    }
  );

  // Resolve short hash to event type info
  app.get<{ Params: { hash: string } }>(
    "/api/public/book-by-hash/:hash",
    async (request, reply) => {
      const { hash } = request.params;

      const eventType = await prisma.eventType.findUnique({
        where: { shortHash: hash },
        select: { id: true, name: true, slug: true, durationMinutes: true, description: true, location: true, color: true, enabled: true, redirectUrl: true, redirectTitle: true, redirectDelaySecs: true, userId: true, brandColor: true, accentColor: true, avatarUrl: true, backgroundUrl: true, backgroundOpacity: true },
      });

      if (!eventType || !eventType.enabled) {
        return reply.code(404).send({ error: "Not found" });
      }

      const user = await prisma.user.findUnique({
        where: { id: eventType.userId },
        select: { username: true, displayName: true, email: true, avatarUrl: true, brandColor: true, accentColor: true, backgroundUrl: true, backgroundOpacity: true },
      });

      if (!user || !user.username) {
        return reply.code(404).send({ error: "Not found" });
      }

      return {
        eventType: { ...eventType, userId: undefined, brandColor: undefined, accentColor: undefined, avatarUrl: undefined, backgroundUrl: undefined, backgroundOpacity: undefined },
        host: { displayName: user.displayName || user.email, username: user.username },
        branding: {
          brandColor: eventType.brandColor || user.brandColor || null,
          accentColor: eventType.accentColor || user.accentColor || null,
          avatarUrl: eventType.avatarUrl || user.avatarUrl || null,
          backgroundUrl: eventType.backgroundUrl || user.backgroundUrl || null,
          backgroundOpacity: eventType.backgroundOpacity ?? user.backgroundOpacity ?? null,
        },
      };
    }
  );
}

export async function computeSlotsForPreview(userId: string, durationMinutes: number, dateStr: string, calendarIds: string[] = [], eventTypeId?: string): Promise<string[]> {
  return computeSlots(userId, durationMinutes, dateStr, calendarIds, eventTypeId);
}

async function computeSlots(userId: string, durationMinutes: number, dateStr: string, calendarIds: string[] = [], eventTypeId?: string): Promise<string[]> {
  const date = new Date(dateStr + "T00:00:00Z");
  const dayOfWeek = date.getUTCDay();

  // 1. Get availability rule for this day (per-event-type first, fall back to user default)
  let rule = eventTypeId
    ? await prisma.availabilityRule.findUnique({
        where: { userId_eventTypeId_dayOfWeek: { userId, eventTypeId, dayOfWeek } },
      })
    : null;
  if (!rule) {
    rule = await prisma.availabilityRule.findFirst({
      where: { userId, eventTypeId: null, dayOfWeek },
    });
  }

  if (!rule || !rule.enabled) return [];

  // Parse working hours into UTC timestamps for this date
  const [startH, startM] = rule.startTime.split(":").map(Number);
  const [endH, endM] = rule.endTime.split(":").map(Number);
  const dayStart = new Date(date);
  dayStart.setUTCHours(startH, startM, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setUTCHours(endH, endM, 0, 0);

  // Don't offer slots in the past
  const now = new Date();
  const effectiveStart = dayStart > now ? dayStart : now;
  if (effectiveStart >= dayEnd) return [];

  // 2. Load busy events for this date (excluding ignored events)
  const events = await prisma.event.findMany({
    where: {
      startTime: { lt: dayEnd },
      endTime: { gt: dayStart },
      ignored: false,
      calendarEntry: {
        source: { userId },
        ...(calendarIds.length > 0
          ? { id: { in: calendarIds } }
          : { enabled: true }),
      },
    },
    select: { startTime: true, endTime: true, allDay: true, providerMetadata: true },
  });

  // Filter to only busy events (not free/transparent)
  const busyEvents = events.filter((e) => {
    const meta = e.providerMetadata as Record<string, unknown> | null;
    if (meta?.showAs === "free" || meta?.transparency === "transparent") return false;
    if (meta?.eventType === "workingLocation") return false;
    return true;
  });

  // 3. Load existing confirmed bookings for this date
  const bookings = await prisma.booking.findMany({
    where: {
      userId,
      status: "confirmed",
      startTime: { lt: dayEnd },
      endTime: { gt: dayStart },
    },
    select: { startTime: true, endTime: true },
  });

  // Combine all busy periods
  const busyPeriods = [
    ...busyEvents.map((e) => ({ start: e.startTime.getTime(), end: e.endTime.getTime() })),
    ...bookings.map((b) => ({ start: b.startTime.getTime(), end: b.endTime.getTime() })),
  ];

  // 4. Generate slots
  const durationMs = durationMinutes * 60 * 1000;
  const slots: string[] = [];

  // Round up effectiveStart to next slot boundary (align to duration intervals from dayStart)
  let cursor = effectiveStart.getTime();
  const startMs = dayStart.getTime();
  if (cursor > startMs) {
    const offset = cursor - startMs;
    const remainder = offset % durationMs;
    if (remainder > 0) cursor += durationMs - remainder;
  } else {
    cursor = startMs;
  }

  while (cursor + durationMs <= dayEnd.getTime()) {
    const slotEnd = cursor + durationMs;

    // Check if slot overlaps any busy period
    const overlaps = busyPeriods.some(
      (bp) => cursor < bp.end && slotEnd > bp.start
    );

    if (!overlaps) {
      slots.push(new Date(cursor).toISOString());
    }

    cursor += durationMs;
  }

  return slots;
}
