import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { formatIcsDate, escapeIcs, foldLine } from "../lib/ics-utils";

export async function icsServeRoutes(app: FastifyInstance) {
  // NO auth middleware — token-based access

  app.get<{ Params: { token: string } }>(
    "/api/ics-feed/:token.ics",
    async (request, reply) => {
      const { token } = request.params;

      const feed = await prisma.icsFeed.findUnique({
        where: { token },
        include: { calendars: { select: { id: true } } },
      });

      if (!feed) {
        return reply.code(404).send("Not found");
      }

      const calendarIds = feed.calendars.map((c) => c.id);

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + feed.daysInAdvance);

      // Load events from selected calendars (or all user calendars if none selected)
      // Include today's events (from start of day, not just "now")
      const events = await prisma.event.findMany({
        where: {
          startTime: { gte: startOfDay, lte: endDate },
          ignored: false,
          calendarEntry: {
            source: { userId: feed.userId },
            ...(calendarIds.length > 0
              ? { id: { in: calendarIds } }
              : { enabled: true }),
          },
        },
        select: {
          sourceEventId: true,
          title: true,
          description: true,
          location: true,
          startTime: true,
          endTime: true,
          allDay: true,
        },
        orderBy: { startTime: "asc" },
      });

      // Generate VCALENDAR
      const lines: string[] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//mein-kalender//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        `X-WR-CALNAME:${escapeIcs(feed.name)}`,
      ];

      for (const event of events) {
        lines.push("BEGIN:VEVENT");
        lines.push(foldLine(`UID:${event.sourceEventId}@mein-kalender`));

        if (event.allDay) {
          const startDate = event.startTime.toISOString().slice(0, 10).replace(/-/g, "");
          const endDate = event.endTime.toISOString().slice(0, 10).replace(/-/g, "");
          lines.push(`DTSTART;VALUE=DATE:${startDate}`);
          lines.push(`DTEND;VALUE=DATE:${endDate}`);
        } else {
          lines.push(`DTSTART:${formatIcsDate(event.startTime)}`);
          lines.push(`DTEND:${formatIcsDate(event.endTime)}`);
        }

        if (feed.mode === "freebusy") {
          lines.push("SUMMARY:Busy");
          lines.push("TRANSP:OPAQUE");
        } else {
          lines.push(foldLine(`SUMMARY:${escapeIcs(event.title)}`));
          if (event.description) {
            lines.push(foldLine(`DESCRIPTION:${escapeIcs(event.description)}`));
          }
          if (event.location) {
            lines.push(foldLine(`LOCATION:${escapeIcs(event.location)}`));
          }
        }

        lines.push("END:VEVENT");
      }

      lines.push("END:VCALENDAR");

      const icsContent = lines.join("\r\n") + "\r\n";

      reply
        .header("Content-Type", "text/calendar; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="${feed.name.replace(/[^a-zA-Z0-9-_]/g, "_")}.ics"`)
        .send(icsContent);
    }
  );
}
