import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { formatIcsDate, escapeIcs, foldLine } from "../lib/ics-utils";

type EventMeta = {
  responseStatus?: string;
  transparency?: string;
  organizerEmail?: string;
  selfEmail?: string;
} | null;

// RFC 5545 PARTSTAT values for the response status the providers normalise to.
const PARTSTAT: Record<string, string> = {
  accepted: "ACCEPTED",
  declined: "DECLINED",
  tentative: "TENTATIVE",
  needsAction: "NEEDS-ACTION",
};

// Lower is better. A copy the user has accepted beats a bare invitation.
const RESPONSE_RANK: Record<string, number> = { accepted: 0, tentative: 1, needsAction: 2, declined: 3 };

function responseRank(meta: EventMeta): number {
  return RESPONSE_RANK[meta?.responseStatus ?? "accepted"] ?? 0;
}

/**
 * The same meeting sits in several calendars: the organiser's own and, for
 * everyone invited, a copy per invitee. All copies share one event id, so they
 * would share one UID, and a subscribing client keeps an arbitrary one of them.
 * Keep exactly one per UID, the copy with the best response status, and leave
 * the order of the feed untouched.
 */
function onePerUid<T extends { sourceEventId: string; providerMetadata: unknown }>(events: T[]): T[] {
  const best = new Map<string, number>();
  events.forEach((ev, i) => {
    const current = best.get(ev.sourceEventId);
    if (
      current === undefined ||
      responseRank(ev.providerMetadata as EventMeta) < responseRank(events[current].providerMetadata as EventMeta)
    ) {
      best.set(ev.sourceEventId, i);
    }
  });
  return events.filter((ev, i) => best.get(ev.sourceEventId) === i);
}

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
          updatedAt: true,
          providerMetadata: true,
          calendarEntry: { select: { name: true } },
        },
        orderBy: { startTime: "asc" },
      });

      // Generate VCALENDAR
      const lines: string[] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//mein-kalender//EN",
        "CALSCALE:GREGORIAN",
        // No METHOD: this is a subscription feed, not an iTIP message. METHOD
        // would drag in RFC 5546's extra requirements (ORGANIZER on every event).
        `X-WR-CALNAME:${escapeIcs(feed.name)}`,
      ];

      for (const event of onePerUid(events)) {
        lines.push("BEGIN:VEVENT");
        lines.push(foldLine(`UID:${event.sourceEventId}@mein-kalender`));
        // DTSTAMP is required (RFC 5545 §3.6.1). Derived from the row's last
        // change, not the request time, so a client polling the feed doesn't
        // see every event as modified on every fetch.
        lines.push(`DTSTAMP:${formatIcsDate(event.updatedAt)}`);

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
          // Which of the user's calendars the event comes from. Left out in
          // freebusy mode: calendar names are details that mode promises to hide.
          const meta = event.providerMetadata as EventMeta;
          if (meta?.organizerEmail) lines.push(foldLine(`ORGANIZER:mailto:${meta.organizerEmail}`));
          if (meta?.selfEmail) {
            const partstat = PARTSTAT[meta.responseStatus ?? "accepted"];
            lines.push(foldLine(`ATTENDEE${partstat ? `;PARTSTAT=${partstat}` : ""}:mailto:${meta.selfEmail}`));
          }
          lines.push(`TRANSP:${meta?.transparency === "transparent" ? "TRANSPARENT" : "OPAQUE"}`);
          const calendarName = event.calendarEntry.name;
          if (calendarName) {
            lines.push(foldLine(`CATEGORIES:${escapeIcs(calendarName)}`));
            lines.push(foldLine(`X-MEINKALENDER-CALENDAR:${escapeIcs(calendarName)}`));
          }
        }

        lines.push("END:VEVENT");
      }

      lines.push("END:VCALENDAR");

      const icsContent = lines.join("\r\n") + "\r\n";

      // The `return` matters. In an async handler, a bare reply.send() lets the
      // handler resolve to undefined while @fastify/compress is still streaming,
      // and the response goes out as Content-Encoding: gzip with an empty body.
      // Any client that sends Accept-Encoding — every browser, and Proton's feed
      // fetcher — then receives zero bytes. Without the header the feed is fine,
      // which is why plain curl never showed it.
      //
      // No Content-Disposition either: a subscription feed is not a download,
      // and Google's iCal feed does not send one.
      return reply
        .header("Content-Type", "text/calendar; charset=utf-8")
        .send(icsContent);
    }
  );
}
