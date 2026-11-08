import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";
import { encrypt } from "../encryption";
import { parseIcs } from "../lib/ics-parse";

interface AuthenticatedRequest {
  user: AuthUser;
}

function validateICS(data: string): boolean {
  return data.includes("BEGIN:VCALENDAR") && data.includes("END:VCALENDAR");
}

export async function icsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // Upload ICS file
  app.post<{ Body: { icsData: string; label?: string } }>(
    "/api/ics/upload",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { icsData, label } = request.body;

      if (!validateICS(icsData)) {
        return reply.code(400).send({ error: "Invalid iCalendar format" });
      }

      const events = parseIcs(icsData);

      // Create or update the ICS source
      const source = await prisma.calendarSource.create({
        data: {
          userId: user.id,
          provider: "ics",
          label: label || "ICS Import",
          credentials: encrypt("{}", process.env.ENCRYPTION_SECRET!),
        },
      });

      const entry = await prisma.calendarEntry.create({
        data: {
          sourceId: source.id,
          name: label || "ICS Import",
          providerCalendarId: `ics-upload-${source.id}`,
          readOnly: true,
        },
      });

      // Insert events
      for (const ev of events) {
        await prisma.event.upsert({
          where: {
            calendarEntryId_sourceEventId: {
              calendarEntryId: entry.id,
              sourceEventId: ev.uid,
            },
          },
          create: {
            calendarEntryId: entry.id,
            sourceEventId: ev.uid,
            title: ev.summary,
            description: ev.description,
            location: ev.location,
            startTime: ev.dtStart,
            endTime: ev.dtEnd,
            allDay: ev.allDay,
          },
          update: {
            title: ev.summary,
            description: ev.description,
            location: ev.location,
            startTime: ev.dtStart,
            endTime: ev.dtEnd,
            allDay: ev.allDay,
          },
        });
      }

      return { sourceId: source.id, eventsImported: events.length };
    }
  );

  // Re-upload (overwrite) ICS for existing source
  app.put<{ Params: { id: string }; Body: { icsData: string } }>(
    "/api/ics/:id/upload",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { icsData } = request.body;

      if (!validateICS(icsData)) {
        return reply.code(400).send({ error: "Invalid iCalendar format" });
      }

      const source = await prisma.calendarSource.findFirst({
        where: { id: request.params.id, userId: user.id, provider: "ics" },
        include: { calendarEntries: true },
      });

      if (!source) {
        return reply.code(404).send({ error: "Not found" });
      }

      const events = parseIcs(icsData);

      // Delete all existing events for this source's entries
      for (const entry of source.calendarEntries) {
        await prisma.event.deleteMany({ where: { calendarEntryId: entry.id } });

        // Re-insert
        for (const ev of events) {
          await prisma.event.create({
            data: {
              calendarEntryId: entry.id,
              sourceEventId: ev.uid,
              title: ev.summary,
              description: ev.description,
              location: ev.location,
              startTime: ev.dtStart,
              endTime: ev.dtEnd,
              allDay: ev.allDay,
            },
          });
        }
      }

      return { eventsImported: events.length };
    }
  );

  // Subscribe to ICS URL
  app.post<{ Body: { url: string; label?: string } }>(
    "/api/ics/subscribe",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { url, label } = request.body;

      // Fetch and validate
      let icsData: string;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          return reply.code(400).send({ error: `Failed to fetch URL: ${res.status}` });
        }
        icsData = await res.text();
      } catch {
        return reply.code(400).send({ error: "Failed to fetch URL" });
      }

      if (!validateICS(icsData)) {
        return reply.code(400).send({ error: "URL does not return valid iCalendar data" });
      }

      const events = parseIcs(icsData);

      const source = await prisma.calendarSource.create({
        data: {
          userId: user.id,
          provider: "ics",
          label: label || "ICS Subscription",
          credentials: encrypt("{}", process.env.ENCRYPTION_SECRET!),
          icsUrl: url,
          syncInterval: 3600, // refresh hourly by default
        },
      });

      const entry = await prisma.calendarEntry.create({
        data: {
          sourceId: source.id,
          name: label || "ICS Subscription",
          providerCalendarId: `ics-url-${source.id}`,
          readOnly: true,
        },
      });

      for (const ev of events) {
        await prisma.event.upsert({
          where: {
            calendarEntryId_sourceEventId: {
              calendarEntryId: entry.id,
              sourceEventId: ev.uid,
            },
          },
          create: {
            calendarEntryId: entry.id,
            sourceEventId: ev.uid,
            title: ev.summary,
            description: ev.description,
            location: ev.location,
            startTime: ev.dtStart,
            endTime: ev.dtEnd,
            allDay: ev.allDay,
          },
          update: {
            title: ev.summary,
            description: ev.description,
            location: ev.location,
            startTime: ev.dtStart,
            endTime: ev.dtEnd,
            allDay: ev.allDay,
          },
        });
      }

      return { sourceId: source.id, eventsImported: events.length };
    }
  );
}
