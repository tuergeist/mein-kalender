import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { decrypt } from "../encryption";
import { getProvider } from "../providers";
import { TokenSet } from "../types";
import { syncQueue, emailQueue } from "../queues";
import { buildIcsInvitation } from "../lib/ics-invitation";
import { bookingSchema, zodPreValidation } from "../lib/validators";

interface SlotParams {
  username: string;
  slug: string;
}

function isTokenExpired(booking: { managementTokenExpiresAt: Date | null }): boolean {
  return booking.managementTokenExpiresAt !== null && new Date() > booking.managementTokenExpiresAt;
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
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
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
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } }, preValidation: zodPreValidation(bookingSchema) },
    async (request, reply) => {
      const { username, slug } = request.params;
      const { startTime, guestName, guestEmail, notes } = request.body;

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

      // Generate management token for guest self-service
      const managementToken = crypto.randomUUID();
      const manageUrl = `https://app.mein-kalender.link/book/manage/${managementToken}`;

      // Create calendar event on host's booking calendar (or target, or first writable)
      let providerEventId: string | null = null;
      let bookingSourceId: string | null = null;
      let icsUid: string | null = null;
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

        const descriptionLines = [
          `Guest: ${guestName} <${guestEmail}>`,
          ...(notes ? [`Notes: ${notes}`] : []),
          "",
          `Manage this booking (cancel or reschedule):`,
          manageUrl,
        ];

        if (bookingEntry && bookingEntry.source.emailForInvitations) {
          // Email-based invitation flow (Proton Calendar / ICS sources)
          const hostEmail = bookingEntry.source.emailForInvitations;
          icsUid = `${crypto.randomUUID()}@mein-kalender.link`;

          const icsContent = buildIcsInvitation({
            method: "REQUEST",
            uid: icsUid,
            sequence: 0,
            organizer: { name: "Mein Kalender", email: process.env.SMTP_FROM || "noreply@mein-kalender.link" },
            attendees: [
              { name: user.displayName || user.email, email: hostEmail },
              { name: guestName, email: guestEmail },
            ],
            summary: `[Booking] ${guestName} — ${eventType.name}`,
            description: descriptionLines.join("\n"),
            location: eventType.location,
            dtStart: start,
            dtEnd: end,
          });

          // Send to host via queue
          emailQueue.add("send", {
            to: hostEmail,
            subject: `Neue Buchung: ${guestName} — ${eventType.name}`,
            text: `${guestName} hat einen Termin gebucht:\n\n${eventType.name}\n${start.toLocaleString("de-DE")} - ${end.toLocaleString("de-DE")}\n\nGast: ${guestName} <${guestEmail}>${notes ? `\nNotizen: ${notes}` : ""}`,
            icalEvent: { method: "REQUEST", content: icsContent },
          }, { removeOnComplete: 100, removeOnFail: 50 }).catch((err) => console.error("[booking] Failed to queue host invitation email:", err));

          // Send to guest via queue
          emailQueue.add("send", {
            to: guestEmail,
            subject: `Terminbestätigung: ${eventType.name} mit ${user.displayName || user.email}`,
            text: `Dein Termin steht:\n\n${eventType.name}\n${start.toLocaleString("de-DE")} - ${end.toLocaleString("de-DE")}\n\nVerwalten: ${manageUrl}`,
            icalEvent: { method: "REQUEST", content: icsContent },
          }, { removeOnComplete: 100, removeOnFail: 50 }).catch((err) => console.error("[booking] Failed to queue guest invitation email:", err));

          providerEventId = icsUid;
          bookingSourceId = bookingEntry.source.id;
        } else if (bookingEntry) {
          // Existing provider API flow (Google/Outlook)
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
            description: descriptionLines.join("\n"),
            location: eventType.location,
            startTime: start,
            endTime: end,
            allDay: false,
            attendees: [{ email: guestEmail, name: guestName }],
          });
          providerEventId = calEvent.sourceEventId;
          bookingSourceId = bookingEntry.source.id;
        }
      } catch (err) {
        console.error("[booking] Failed to create calendar event:", err);
      }

      // Management token expires 7 days after the event ends
      const managementTokenExpiresAt = new Date(end.getTime() + 7 * 24 * 60 * 60 * 1000);

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
          managementToken,
          managementTokenExpiresAt,
          icsUid,
        },
      });

      // Trigger immediate sync so the booking event appears in the calendar view
      if (bookingSourceId) {
        syncQueue.add("sync-source", { sourceId: bookingSourceId, userId: user.id }, {
          jobId: `sync-${bookingSourceId}-booking-${Date.now()}`,
          removeOnComplete: 10,
          removeOnFail: 5,
        }).catch((err) => {
          console.warn("[booking] Failed to queue immediate sync:", err);
        });
      }

      return reply.code(201).send({
        booking: {
          id: booking.id,
          startTime: booking.startTime,
          endTime: booking.endTime,
          eventTypeName: eventType.name,
          hostName: user.displayName || user.email,
          manageUrl,
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

  // ── Guest management endpoints (token-based, no auth) ──

  // Get booking details by management token
  app.get<{ Params: { token: string } }>(
    "/api/public/booking/:token",
    async (request, reply) => {
      const { token } = request.params;

      const booking = await prisma.booking.findUnique({
        where: { managementToken: token },
        include: {
          eventType: {
            select: {
              name: true, slug: true, durationMinutes: true, location: true,
              brandColor: true, accentColor: true, avatarUrl: true,
              backgroundUrl: true, backgroundOpacity: true,
            },
          },
          user: {
            select: {
              username: true, displayName: true, email: true,
              brandColor: true, accentColor: true, avatarUrl: true,
              backgroundUrl: true, backgroundOpacity: true,
            },
          },
        },
      });

      if (!booking) {
        return reply.code(404).send({ error: "Booking not found" });
      }

      if (isTokenExpired(booking)) {
        return reply.code(410).send({ error: "Management link has expired. Please contact the host to manage this booking." });
      }

      return {
        booking: {
          id: booking.id,
          startTime: booking.startTime,
          endTime: booking.endTime,
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          notes: booking.notes,
          status: booking.status,
        },
        eventType: {
          name: booking.eventType.name,
          slug: booking.eventType.slug,
          durationMinutes: booking.eventType.durationMinutes,
          location: booking.eventType.location,
        },
        host: {
          displayName: booking.user.displayName || booking.user.email,
          username: booking.user.username,
        },
        branding: {
          brandColor: booking.eventType.brandColor || booking.user.brandColor || null,
          accentColor: booking.eventType.accentColor || booking.user.accentColor || null,
          avatarUrl: booking.eventType.avatarUrl || booking.user.avatarUrl || null,
          backgroundUrl: booking.eventType.backgroundUrl || booking.user.backgroundUrl || null,
          backgroundOpacity: booking.eventType.backgroundOpacity ?? booking.user.backgroundOpacity ?? null,
        },
      };
    }
  );

  // Cancel booking by management token
  app.post<{ Params: { token: string } }>(
    "/api/public/booking/:token/cancel",
    async (request, reply) => {
      const { token } = request.params;

      const booking = await prisma.booking.findUnique({
        where: { managementToken: token },
      });

      if (!booking) {
        return reply.code(404).send({ error: "Booking not found" });
      }

      if (isTokenExpired(booking)) {
        return reply.code(410).send({ error: "Management link has expired. Please contact the host to manage this booking." });
      }

      if (booking.status === "cancelled") {
        return reply.code(400).send({ error: "Booking is already cancelled" });
      }

      // Delete provider calendar event if it exists and booking is in the future
      if (booking.providerEventId && booking.startTime > new Date()) {
        try {
          const bookingEntry = await findBookingCalendarEntry(booking.userId, booking.eventTypeId);
          if (bookingEntry?.source.emailForInvitations) {
            // Email-based cancellation (Proton Calendar / ICS sources)
            const icsContent = buildIcsInvitation({
              method: "CANCEL",
              uid: booking.icsUid || booking.providerEventId,
              sequence: (booking.icsSequence || 0) + 1,
              organizer: { name: "Mein Kalender", email: process.env.SMTP_FROM || "noreply@mein-kalender.link" },
              attendees: [
                { name: "", email: bookingEntry.source.emailForInvitations },
                { name: booking.guestName, email: booking.guestEmail },
              ],
              summary: `[Booking] ${booking.guestName} — Abgesagt`,
              dtStart: booking.startTime,
              dtEnd: booking.endTime,
              status: "CANCELLED",
            });

            emailQueue.add("send", {
              to: bookingEntry.source.emailForInvitations,
              subject: `Buchung abgesagt: ${booking.guestName}`,
              text: `Die Buchung wurde abgesagt.`,
              icalEvent: { method: "CANCEL", content: icsContent },
            }, { removeOnComplete: 100, removeOnFail: 50 }).catch((err) => console.error("[booking] Cancel email failed:", err));

            emailQueue.add("send", {
              to: booking.guestEmail,
              subject: `Termin abgesagt`,
              text: `Dein Termin wurde abgesagt.`,
              icalEvent: { method: "CANCEL", content: icsContent },
            }, { removeOnComplete: 100, removeOnFail: 50 }).catch((err) => console.error("[booking] Cancel guest email failed:", err));
          } else if (bookingEntry) {
            // Existing provider API flow (Google/Outlook)
            const provider = getProvider(bookingEntry.source.provider);
            const creds = JSON.parse(
              decrypt(bookingEntry.source.credentials, process.env.ENCRYPTION_SECRET!)
            );
            const tokenSet: TokenSet = {
              accessToken: creds.accessToken || "",
              refreshToken: creds.refreshToken || null,
              expiresAt: creds.expiresAt ? new Date(creds.expiresAt) : null,
            };
            await provider.deleteEvent(tokenSet, bookingEntry.providerCalendarId, booking.providerEventId);
          }
        } catch (err) {
          console.error(`[booking] Failed to delete provider event for booking ${booking.id}:`, err);
        }
      }

      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "cancelled" },
      });

      // Trigger sync so cancellation reflects in calendar view
      const cancelEntry = await findBookingCalendarEntry(booking.userId, booking.eventTypeId);
      if (cancelEntry) {
        syncQueue.add("sync-source", { sourceId: cancelEntry.source.id, userId: booking.userId }, {
          jobId: `sync-${cancelEntry.source.id}-cancel-${Date.now()}`,
          removeOnComplete: 10,
          removeOnFail: 5,
        }).catch(() => {});
      }

      return { success: true };
    }
  );

  // Get available slots for rescheduling
  app.get<{ Params: { token: string }; Querystring: { date: string } }>(
    "/api/public/booking/:token/slots",
    async (request, reply) => {
      const { token } = request.params;
      const { date } = request.query;

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return reply.code(400).send({ error: "date query param required (YYYY-MM-DD)" });
      }

      const booking = await prisma.booking.findUnique({
        where: { managementToken: token },
        include: {
          eventType: { include: { calendars: { select: { id: true } } } },
        },
      });

      if (!booking) {
        return reply.code(404).send({ error: "Booking not found" });
      }

      if (isTokenExpired(booking)) {
        return reply.code(410).send({ error: "Management link has expired. Please contact the host to manage this booking." });
      }

      if (booking.status === "cancelled") {
        return reply.code(400).send({ error: "Booking is cancelled" });
      }

      const calendarIds = booking.eventType.calendars.map((c) => c.id);
      const slots = await computeSlots(
        booking.userId, booking.eventType.durationMinutes, date, calendarIds, booking.eventTypeId
      );
      return { date, slots };
    }
  );

  // Get available days for rescheduling
  app.get<{ Params: { token: string }; Querystring: { month: string } }>(
    "/api/public/booking/:token/available-days",
    async (request, reply) => {
      const { token } = request.params;
      const { month } = request.query;

      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return reply.code(400).send({ error: "month query param required (YYYY-MM)" });
      }

      const booking = await prisma.booking.findUnique({
        where: { managementToken: token },
        include: {
          eventType: { include: { calendars: { select: { id: true } } } },
        },
      });

      if (!booking) {
        return reply.code(404).send({ error: "Booking not found" });
      }

      if (isTokenExpired(booking)) {
        return reply.code(410).send({ error: "Management link has expired. Please contact the host to manage this booking." });
      }

      if (booking.status === "cancelled") {
        return reply.code(400).send({ error: "Booking is cancelled" });
      }

      const calendarIds = booking.eventType.calendars.map((c) => c.id);
      const [year, mon] = month.split("-").map(Number);
      const daysInMonth = new Date(year, mon, 0).getDate();
      const availableDays: string[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const slots = await computeSlots(booking.userId, booking.eventType.durationMinutes, dateStr, calendarIds, booking.eventTypeId);
        if (slots.length > 0) availableDays.push(dateStr);
      }

      return { month, availableDays };
    }
  );

  // Reschedule booking by management token
  app.post<{ Params: { token: string }; Body: { startTime: string } }>(
    "/api/public/booking/:token/reschedule",
    async (request, reply) => {
      const { token } = request.params;
      const { startTime } = request.body;

      if (!startTime) {
        return reply.code(400).send({ error: "startTime is required" });
      }

      const booking = await prisma.booking.findUnique({
        where: { managementToken: token },
        include: {
          eventType: { include: { calendars: { select: { id: true } } } },
          user: { select: { id: true, displayName: true, email: true, bookingCalendarEntryId: true } },
        },
      });

      if (!booking) {
        return reply.code(404).send({ error: "Booking not found" });
      }

      if (isTokenExpired(booking)) {
        return reply.code(410).send({ error: "Management link has expired. Please contact the host to manage this booking." });
      }

      if (booking.status === "cancelled") {
        return reply.code(400).send({ error: "Booking is cancelled" });
      }

      const newStart = new Date(startTime);
      const newEnd = new Date(newStart.getTime() + booking.eventType.durationMinutes * 60 * 1000);
      const dateStr = newStart.toISOString().slice(0, 10);

      // Verify the new slot is available
      const calendarIds = booking.eventType.calendars.map((c) => c.id);
      const slots = await computeSlots(
        booking.userId, booking.eventType.durationMinutes, dateStr, calendarIds, booking.eventTypeId
      );
      const slotAvailable = slots.some((s) => new Date(s).getTime() === newStart.getTime());
      if (!slotAvailable) {
        return reply.code(409).send({ error: "This slot is no longer available" });
      }

      // Update or recreate calendar event
      const manageUrl = `https://app.mein-kalender.link/book/manage/${token}`;
      const descriptionLines = [
        `Guest: ${booking.guestName} <${booking.guestEmail}>`,
        ...(booking.notes ? [`Notes: ${booking.notes}`] : []),
        "",
        `Manage this booking (cancel or reschedule):`,
        manageUrl,
      ];

      try {
        const bookingEntry = await findBookingCalendarEntry(booking.userId, booking.eventTypeId);
        if (bookingEntry?.source.emailForInvitations) {
          // Email-based reschedule (Proton Calendar / ICS sources)
          const newSequence = (booking.icsSequence || 0) + 1;
          const icsContent = buildIcsInvitation({
            method: "REQUEST",
            uid: booking.icsUid || booking.providerEventId!,
            sequence: newSequence,
            organizer: { name: "Mein Kalender", email: process.env.SMTP_FROM || "noreply@mein-kalender.link" },
            attendees: [
              { name: "", email: bookingEntry.source.emailForInvitations },
              { name: booking.guestName, email: booking.guestEmail },
            ],
            summary: `[Booking] ${booking.guestName} — ${booking.eventType.name}`,
            description: descriptionLines.join("\n"),
            location: booking.eventType.location,
            dtStart: newStart,
            dtEnd: newEnd,
          });

          // Send updated invitation to both host and guest
          for (const to of [bookingEntry.source.emailForInvitations, booking.guestEmail]) {
            emailQueue.add("send", {
              to,
              subject: `Termin verschoben: ${booking.eventType.name}`,
              text: `Der Termin wurde verschoben.`,
              icalEvent: { method: "REQUEST", content: icsContent },
            }, { removeOnComplete: 100, removeOnFail: 50 }).catch(() => {});
          }

          await prisma.booking.update({
            where: { id: booking.id },
            data: { startTime: newStart, endTime: newEnd, icsSequence: newSequence },
          });
        } else if (bookingEntry) {
          // Existing provider API flow (Google/Outlook)
          const provider = getProvider(bookingEntry.source.provider);
          const creds = JSON.parse(
            decrypt(bookingEntry.source.credentials, process.env.ENCRYPTION_SECRET!)
          );
          const tokenSet: TokenSet = {
            accessToken: creds.accessToken || "",
            refreshToken: creds.refreshToken || null,
            expiresAt: creds.expiresAt ? new Date(creds.expiresAt) : null,
          };

          // Delete old event and create new one
          if (booking.providerEventId) {
            try {
              await provider.deleteEvent(tokenSet, bookingEntry.providerCalendarId, booking.providerEventId);
            } catch (err) {
              console.error(`[booking] Failed to delete old provider event for reschedule:`, err);
            }
          }

          const calEvent = await provider.createEvent(tokenSet, bookingEntry.providerCalendarId, {
            title: `[Booking] ${booking.guestName} — ${booking.eventType.name}`,
            description: descriptionLines.join("\n"),
            location: booking.eventType.location,
            startTime: newStart,
            endTime: newEnd,
            allDay: false,
            attendees: [{ email: booking.guestEmail, name: booking.guestName }],
          });

          await prisma.booking.update({
            where: { id: booking.id },
            data: { startTime: newStart, endTime: newEnd, providerEventId: calEvent.sourceEventId },
          });
        } else {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { startTime: newStart, endTime: newEnd },
          });
        }
      } catch (err) {
        console.error(`[booking] Failed to reschedule calendar event:`, err);
        // Still update the booking in the database even if calendar update fails
        await prisma.booking.update({
          where: { id: booking.id },
          data: { startTime: newStart, endTime: newEnd },
        });
      }

      // Trigger sync so reschedule reflects in calendar view
      const rescheduleEntry = await findBookingCalendarEntry(booking.userId, booking.eventTypeId);
      if (rescheduleEntry) {
        syncQueue.add("sync-source", { sourceId: rescheduleEntry.source.id, userId: booking.userId }, {
          jobId: `sync-${rescheduleEntry.source.id}-reschedule-${Date.now()}`,
          removeOnComplete: 10,
          removeOnFail: 5,
        }).catch(() => {});
      }

      return {
        success: true,
        booking: {
          startTime: newStart,
          endTime: newEnd,
        },
      };
    }
  );
}

/** Find the calendar entry used for booking events for a given user/event type */
async function findBookingCalendarEntry(userId: string, eventTypeId: string) {
  // 1. Try event-type-specific booking calendar
  const eventType = await prisma.eventType.findUnique({
    where: { id: eventTypeId },
    select: { bookingCalendarEntryId: true },
  });
  if (eventType?.bookingCalendarEntryId) {
    const entry = await prisma.calendarEntry.findFirst({
      where: { id: eventType.bookingCalendarEntryId, source: { userId } },
      include: { source: true },
    });
    if (entry) return entry;
  }

  // 2. Try user's global booking calendar
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bookingCalendarEntryId: true },
  });
  if (user?.bookingCalendarEntryId) {
    const entry = await prisma.calendarEntry.findFirst({
      where: { id: user.bookingCalendarEntryId, source: { userId } },
      include: { source: true },
    });
    if (entry) return entry;
  }

  // 3. Fall back to target calendar, then first writable
  return prisma.calendarEntry.findFirst({
    where: {
      source: { userId },
      OR: [{ isTarget: true }, { readOnly: false }],
    },
    include: { source: true },
    orderBy: { isTarget: "desc" },
  });
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
