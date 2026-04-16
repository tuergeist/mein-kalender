// @ts-nocheck — MCP SDK registerTool generics cause TS2589 with Zod v3 (runtime validation works correctly)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { prisma } from "./lib/prisma";
import { decrypt } from "./encryption";
import { getProvider } from "./providers";
import { TokenSet } from "./types";

function getTokenSet(credentials: string): TokenSet {
  return JSON.parse(decrypt(credentials, process.env.ENCRYPTION_SECRET!));
}

export function createMcpServer(userId: string): McpServer {
  const server = new McpServer(
    { name: "mein-kalender", version: "1.0.0" },
    {
      instructions: "Kalender-MCP-Server für Mein Kalender. Liest und verwaltet Kalendertermine über Google, Outlook und Apple Kalender.",
    }
  );

  // --- list_calendars ---
  server.registerTool(
    "list_calendars",
    {
      description: "Alle Kalender des Benutzers auflisten mit Provider, Name und Schreibstatus",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_args: unknown) => {
      const sources = await prisma.calendarSource.findMany({
        where: { userId },
        include: { calendarEntries: { where: { enabled: true } } },
      });

      const calendars = sources.flatMap((source) =>
        source.calendarEntries.map((entry) => ({
          id: entry.id,
          name: entry.name,
          provider: source.provider,
          label: source.label,
          readOnly: entry.readOnly,
          color: entry.userColor || entry.color,
        }))
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(calendars, null, 2) }],
      };
    }
  );

  // --- list_events ---
  server.registerTool(
    "list_events",
    {
      description: "Termine aus der Datenbank abrufen, gefiltert nach Datum und optional Kalender oder Suchbegriff",
      inputSchema: z.object({
        startDate: z.string().describe("Startdatum (ISO 8601, z.B. 2026-04-16)"),
        endDate: z.string().describe("Enddatum (ISO 8601, z.B. 2026-04-17)"),
        calendarId: z.string().optional().describe("Kalender-ID zum Filtern (optional)"),
        search: z.string().optional().describe("Suchbegriff für Titel (optional)"),
      }),
      annotations: { readOnlyHint: true },
    },
    async (args: unknown) => {
      const { startDate, endDate, calendarId, search } = args as {
        startDate: string; endDate: string; calendarId?: string; search?: string;
      };
      const start = new Date(startDate);
      const end = new Date(endDate);

      const events = await prisma.event.findMany({
        where: {
          calendarEntry: {
            source: { userId },
            enabled: true,
            ...(calendarId && { id: calendarId }),
          },
          startTime: { lt: end },
          endTime: { gt: start },
          ...(search && { title: { contains: search, mode: "insensitive" as const } }),
        },
        include: {
          calendarEntry: { select: { name: true, id: true } },
        },
        orderBy: { startTime: "asc" },
        take: 200,
      });

      const result = events.map((e) => ({
        id: e.id,
        sourceEventId: e.sourceEventId,
        calendarId: e.calendarEntry.id,
        calendarName: e.calendarEntry.name,
        title: e.title,
        description: e.description,
        location: e.location,
        startTime: e.startTime.toISOString(),
        endTime: e.endTime.toISOString(),
        allDay: e.allDay,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // --- create_event ---
  server.registerTool(
    "create_event",
    {
      description: "Einen neuen Termin in einem beschreibbaren Kalender erstellen",
      inputSchema: z.object({
        calendarId: z.string().describe("Kalender-ID (aus list_calendars)"),
        title: z.string().describe("Titel des Termins"),
        startTime: z.string().describe("Startzeit (ISO 8601, z.B. 2026-04-17T14:00:00Z)"),
        endTime: z.string().describe("Endzeit (ISO 8601, z.B. 2026-04-17T15:00:00Z)"),
        description: z.string().optional().describe("Beschreibung (optional)"),
        location: z.string().optional().describe("Ort (optional)"),
        allDay: z.boolean().optional().describe("Ganztägig (optional, default: false)"),
      }),
    },
    async (args: unknown) => {
      const { calendarId, title, startTime, endTime, description, location, allDay } = args as {
        calendarId: string; title: string; startTime: string; endTime: string;
        description?: string; location?: string; allDay?: boolean;
      };

      const entry = await prisma.calendarEntry.findFirst({
        where: { id: calendarId, source: { userId }, enabled: true },
        include: { source: true },
      });

      if (!entry) {
        return { content: [{ type: "text" as const, text: "Kalender nicht gefunden." }], isError: true };
      }
      if (entry.readOnly) {
        return { content: [{ type: "text" as const, text: "Kalender ist schreibgeschützt." }], isError: true };
      }

      const provider = getProvider(entry.source.provider);
      const token = getTokenSet(entry.source.credentials);

      const created = await provider.createEvent(token, entry.providerCalendarId, {
        title,
        description: description || null,
        location: location || null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        allDay: allDay || false,
      });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            message: "Termin erstellt",
            id: created.sourceEventId,
            title: created.title,
            startTime: created.startTime.toISOString(),
            endTime: created.endTime.toISOString(),
          }, null, 2),
        }],
      };
    }
  );

  // --- update_event ---
  server.registerTool(
    "update_event",
    {
      description: "Einen bestehenden Termin aktualisieren",
      inputSchema: z.object({
        calendarId: z.string().describe("Kalender-ID"),
        eventId: z.string().describe("Event-ID (sourceEventId aus list_events)"),
        title: z.string().optional().describe("Neuer Titel"),
        startTime: z.string().optional().describe("Neue Startzeit (ISO 8601)"),
        endTime: z.string().optional().describe("Neue Endzeit (ISO 8601)"),
        description: z.string().optional().describe("Neue Beschreibung"),
        location: z.string().optional().describe("Neuer Ort"),
      }),
    },
    async (args: unknown) => {
      const { calendarId, eventId, title, startTime, endTime, description, location } = args as {
        calendarId: string; eventId: string; title?: string; startTime?: string;
        endTime?: string; description?: string; location?: string;
      };

      const entry = await prisma.calendarEntry.findFirst({
        where: { id: calendarId, source: { userId }, enabled: true },
        include: { source: true },
      });

      if (!entry) {
        return { content: [{ type: "text" as const, text: "Kalender nicht gefunden." }], isError: true };
      }
      if (entry.readOnly) {
        return { content: [{ type: "text" as const, text: "Kalender ist schreibgeschützt." }], isError: true };
      }

      const provider = getProvider(entry.source.provider);
      const token = getTokenSet(entry.source.credentials);

      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (location !== undefined) updates.location = location;
      if (startTime !== undefined) updates.startTime = new Date(startTime);
      if (endTime !== undefined) updates.endTime = new Date(endTime);

      const updated = await provider.updateEvent(token, entry.providerCalendarId, eventId, updates);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            message: "Termin aktualisiert",
            title: updated.title,
            startTime: updated.startTime.toISOString(),
            endTime: updated.endTime.toISOString(),
          }, null, 2),
        }],
      };
    }
  );

  // --- delete_event ---
  server.registerTool(
    "delete_event",
    {
      description: "Einen Termin löschen",
      inputSchema: z.object({
        calendarId: z.string().describe("Kalender-ID"),
        eventId: z.string().describe("Event-ID (sourceEventId aus list_events)"),
      }),
    },
    async (args: unknown) => {
      const { calendarId, eventId } = args as { calendarId: string; eventId: string };

      const entry = await prisma.calendarEntry.findFirst({
        where: { id: calendarId, source: { userId }, enabled: true },
        include: { source: true },
      });

      if (!entry) {
        return { content: [{ type: "text" as const, text: "Kalender nicht gefunden." }], isError: true };
      }
      if (entry.readOnly) {
        return { content: [{ type: "text" as const, text: "Kalender ist schreibgeschützt." }], isError: true };
      }

      const provider = getProvider(entry.source.provider);
      const token = getTokenSet(entry.source.credentials);

      await provider.deleteEvent(token, entry.providerCalendarId, eventId);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ message: "Termin gelöscht", eventId }, null, 2),
        }],
      };
    }
  );

  return server;
}

export { StreamableHTTPServerTransport };
