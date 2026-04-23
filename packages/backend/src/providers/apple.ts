import { DAVClient, DAVCalendar, DAVCalendarObject } from "tsdav";
import ICAL from "ical.js";
import ical from "ical-generator";
import {
  CalendarProviderInterface,
  NormalizedCalendar,
  NormalizedEvent,
  EventDelta,
  TokenSet,
  Provider,
} from "../types";
import { ProviderError, ProviderErrorCode } from "../errors";

export class AppleCalendarProvider implements CalendarProviderInterface {
  private createClient(token: TokenSet): DAVClient {
    return new DAVClient({
      serverUrl: "https://caldav.icloud.com",
      credentials: {
        username: token.refreshToken || "", // Apple ID stored in refreshToken
        password: token.accessToken,        // App-specific password in accessToken
      },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });
  }

  async authenticate(credentials: Record<string, string>): Promise<TokenSet> {
    const { appleId, appPassword } = credentials;
    const client = new DAVClient({
      serverUrl: "https://caldav.icloud.com",
      credentials: { username: appleId, password: appPassword },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });

    try {
      await client.login();
      const calendars = await client.fetchCalendars();
      if (!calendars || calendars.length === 0) {
        throw new ProviderError("No calendars found", ProviderErrorCode.PERMISSION_DENIED, "apple");
      }
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError("Authentication failed", ProviderErrorCode.AUTH_EXPIRED, "apple");
    }

    return {
      accessToken: appPassword,
      refreshToken: appleId,
      expiresAt: null,
    };
  }

  async listCalendars(token: TokenSet): Promise<NormalizedCalendar[]> {
    const client = this.createClient(token);
    await client.login();
    const calendars = await client.fetchCalendars();

    return calendars.map((cal) => ({
      id: cal.url,
      providerCalendarId: cal.url,
      name: (typeof cal.displayName === "string" ? cal.displayName : null) || "Untitled",
      color: extractColor(cal) || "#007aff",
      provider: Provider.APPLE,
      readOnly: false, // CalDAV with write scope
    }));
  }

  async getEvents(
    token: TokenSet,
    calendarId: string,
    syncToken?: string | null,
    fetchDaysInAdvance?: number
  ): Promise<EventDelta> {
    const client = this.createClient(token);
    await client.login();

    if (syncToken) {
      return this.getDeltaEvents(client, calendarId, syncToken);
    }
    return this.getFullEvents(client, calendarId, fetchDaysInAdvance);
  }

  private async getFullEvents(
    client: DAVClient,
    calendarId: string,
    fetchDaysInAdvance?: number
  ): Promise<EventDelta> {
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 30);
    const daysAhead = fetchDaysInAdvance || 90;
    const timeMax = new Date(Date.now() + daysAhead * 86400000);

    const calendar: DAVCalendar = { url: calendarId };
    const objects = await client.fetchCalendarObjects({
      calendar,
      timeRange: {
        start: timeMin.toISOString(),
        end: timeMax.toISOString(),
      },
    });

    const created: NormalizedEvent[] = [];
    const deleted: string[] = [];

    for (const obj of objects) {
      if (!obj.data) continue;
      const parsed = parseIcsToNormalizedEvent(obj.data, calendarId);
      if (!parsed) continue;

      if (parsed.cancelled) {
        deleted.push(parsed.event.sourceEventId);
      } else {
        created.push(parsed.event);
      }
    }

    // Get sync token for future delta syncs
    const calendars = await client.fetchCalendars();
    const cal = calendars.find((c) => c.url === calendarId);
    const nextSyncToken = cal?.syncToken || cal?.ctag || null;

    return { created, updated: [], deleted, nextSyncToken };
  }

  private async getDeltaEvents(
    client: DAVClient,
    calendarId: string,
    syncToken: string
  ): Promise<EventDelta> {
    try {
      const result = await client.smartCollectionSync({
        collection: {
          url: calendarId,
          syncToken,
          objects: [],
        },
        detailedResult: true,
      });

      const objects = result.objects as {
        created: DAVCalendarObject[];
        updated: DAVCalendarObject[];
        deleted: DAVCalendarObject[];
      };

      const created: NormalizedEvent[] = [];
      const updated: NormalizedEvent[] = [];
      const deleted: string[] = [];

      for (const obj of objects.created || []) {
        if (!obj.data) continue;
        const parsed = parseIcsToNormalizedEvent(obj.data, calendarId);
        if (!parsed) continue;
        if (parsed.cancelled) {
          deleted.push(parsed.event.sourceEventId);
        } else {
          created.push(parsed.event);
        }
      }

      for (const obj of objects.updated || []) {
        if (!obj.data) continue;
        const parsed = parseIcsToNormalizedEvent(obj.data, calendarId);
        if (!parsed) continue;
        if (parsed.cancelled) {
          deleted.push(parsed.event.sourceEventId);
        } else {
          updated.push(parsed.event);
        }
      }

      for (const obj of objects.deleted || []) {
        // Deleted objects may only have a URL, extract UID from it
        const uid = obj.url?.split("/").pop()?.replace(".ics", "") || obj.etag || "";
        if (uid) deleted.push(uid);
      }

      // Get updated sync token
      const calendars = await client.fetchCalendars();
      const cal = calendars.find((c) => c.url === calendarId);
      const nextSyncToken = cal?.syncToken || cal?.ctag || null;

      return { created, updated, deleted, nextSyncToken };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("invalid") || message.includes("expired") || message.includes("410")) {
        throw new ProviderError("Sync token expired", ProviderErrorCode.INVALID_SYNC_TOKEN, "apple");
      }
      throw err;
    }
  }

  async createEvent(
    token: TokenSet,
    calendarId: string,
    event: Omit<NormalizedEvent, "id" | "sourceEventId" | "calendarId">
  ): Promise<NormalizedEvent> {
    const client = this.createClient(token);
    await client.login();

    const uid = generateUid();
    const icsString = buildIcsFromEvent({ ...event, uid });

    await client.createCalendarObject({
      calendar: { url: calendarId },
      iCalString: icsString,
      filename: `${uid}.ics`,
    });

    return {
      id: "",
      sourceEventId: uid,
      calendarId,
      title: event.title,
      description: event.description,
      location: event.location,
      startTime: event.startTime,
      endTime: event.endTime,
      allDay: event.allDay,
    };
  }

  async updateEvent(
    token: TokenSet,
    calendarId: string,
    eventId: string,
    event: Partial<Omit<NormalizedEvent, "id" | "sourceEventId" | "calendarId">>
  ): Promise<NormalizedEvent> {
    const client = this.createClient(token);
    await client.login();

    // Fetch current object to get etag and existing data
    const objects = await client.fetchCalendarObjects({
      calendar: { url: calendarId },
    });
    const existing = objects.find((obj) => {
      if (!obj.data) return false;
      const parsed = parseIcsToNormalizedEvent(obj.data, calendarId);
      return parsed?.event.sourceEventId === eventId;
    });

    if (!existing) {
      throw new ProviderError("Event not found", ProviderErrorCode.NOT_FOUND, "apple");
    }

    // Parse existing, merge changes, rebuild ICS
    const parsed = parseIcsToNormalizedEvent(existing.data!, calendarId)!;
    const merged = {
      uid: eventId,
      title: event.title ?? parsed.event.title,
      description: event.description !== undefined ? event.description : parsed.event.description,
      location: event.location !== undefined ? event.location : parsed.event.location,
      startTime: event.startTime ?? parsed.event.startTime,
      endTime: event.endTime ?? parsed.event.endTime,
      allDay: event.allDay ?? parsed.event.allDay,
    };

    const icsString = buildIcsFromEvent(merged);

    await client.updateCalendarObject({
      calendarObject: {
        url: existing.url,
        data: icsString,
        etag: existing.etag,
      },
    });

    return {
      id: "",
      sourceEventId: eventId,
      calendarId,
      title: merged.title,
      description: merged.description,
      location: merged.location,
      startTime: merged.startTime,
      endTime: merged.endTime,
      allDay: merged.allDay,
    };
  }

  async deleteEvent(
    token: TokenSet,
    calendarId: string,
    eventId: string
  ): Promise<void> {
    const client = this.createClient(token);
    await client.login();

    const objects = await client.fetchCalendarObjects({
      calendar: { url: calendarId },
    });
    const existing = objects.find((obj) => {
      if (!obj.data) return false;
      const parsed = parseIcsToNormalizedEvent(obj.data, calendarId);
      return parsed?.event.sourceEventId === eventId;
    });

    if (!existing) return; // Idempotent delete

    try {
      await client.deleteCalendarObject({
        calendarObject: {
          url: existing.url,
          etag: existing.etag,
        },
      });
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) return; // Already deleted
      throw err;
    }
  }
}

// --- Helpers ---

function parseIcsToNormalizedEvent(
  icsData: string,
  calendarId: string
): { event: NormalizedEvent; cancelled: boolean } | null {
  try {
    const jcal = ICAL.parse(icsData);
    const vcalendar = new ICAL.Component(jcal);
    const vevent = vcalendar.getFirstSubcomponent("vevent");
    if (!vevent) return null;

    const event = new ICAL.Event(vevent);
    const status = vevent.getFirstPropertyValue("status") as string | null;
    const transp = vevent.getFirstPropertyValue("transp") as string | null;

    const metadata: Record<string, unknown> = {};
    if (transp?.toUpperCase() === "TRANSPARENT") {
      metadata.showAs = "free";
      metadata.transparency = "transparent";
    } else {
      metadata.showAs = "busy";
    }

    const allDay = event.startDate?.isDate ?? false;

    return {
      event: {
        id: "",
        sourceEventId: event.uid,
        calendarId,
        title: event.summary || "(No title)",
        description: event.description || null,
        location: event.location || null,
        startTime: event.startDate.toJSDate(),
        endTime: event.endDate.toJSDate(),
        allDay,
        providerMetadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      },
      cancelled: status?.toUpperCase() === "CANCELLED",
    };
  } catch (err) {
    console.error("[apple] Failed to parse ICS:", err);
    return null;
  }
}

function buildIcsFromEvent(event: {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
}): string {
  const calendar = ical({ name: "Mein Kalender" });
  calendar.createEvent({
    id: event.uid,
    summary: event.title,
    description: event.description || undefined,
    location: event.location || undefined,
    start: event.startTime,
    end: event.endTime,
    allDay: event.allDay,
  });
  return calendar.toString();
}

function extractColor(cal: DAVCalendar): string | null {
  // Apple exposes calendar color via projectedProps or custom properties
  const props = cal as Record<string, unknown>;
  if (typeof props.color === "string") return props.color;
  const projected = props.projectedProps as Record<string, unknown> | undefined;
  if (projected) {
    const color = projected["calendar-color"] || projected["apple:calendar-color"];
    if (typeof color === "string") return color.slice(0, 7); // Strip alpha
  }
  return null;
}

function generateUid(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let uid = "";
  for (let i = 0; i < 32; i++) {
    uid += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${uid}@mein-kalender.link`;
}
