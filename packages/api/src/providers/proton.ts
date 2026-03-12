import {
  CalendarProviderInterface,
  NormalizedCalendar,
  NormalizedEvent,
  EventDelta,
  TokenSet,
  ProviderError,
  ProviderErrorCode,
  Provider,
} from "@calendar-sync/shared";

/**
 * Proton Calendar adapter using CalDAV via proton-mail-bridge.
 *
 * The bridge exposes CalDAV at a local endpoint. Credentials are
 * bridge-generated (not Proton account credentials).
 */
export class ProtonCalendarProvider implements CalendarProviderInterface {
  /**
   * For Proton, "authenticate" verifies the CalDAV bridge connection.
   * Credentials: { host, port, username, password }
   */
  async authenticate(credentials: Record<string, string>): Promise<TokenSet> {
    const { host, port, username, password } = credentials;
    const baseUrl = `http://${host}:${port}`;

    try {
      const res = await fetch(`${baseUrl}/dav/principals/`, {
        method: "PROPFIND",
        headers: {
          Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
          Depth: "0",
          "Content-Type": "application/xml",
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
          <d:propfind xmlns:d="DAV:">
            <d:prop><d:current-user-principal/></d:prop>
          </d:propfind>`,
      });

      if (!res.ok) {
        throw new ProviderError(
          "Failed to authenticate with Proton bridge",
          ProviderErrorCode.AUTH_EXPIRED,
          "proton"
        );
      }

      // For CalDAV, we store credentials as the "token"
      return {
        accessToken: Buffer.from(`${username}:${password}`).toString("base64"),
        refreshToken: null,
        expiresAt: null,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(
        "Proton bridge unavailable",
        ProviderErrorCode.PROVIDER_UNAVAILABLE,
        "proton",
        err as Error
      );
    }
  }

  async listCalendars(token: TokenSet): Promise<NormalizedCalendar[]> {
    const baseUrl = this.getBaseUrl(token);

    try {
      const res = await fetch(`${baseUrl}/dav/calendars/`, {
        method: "PROPFIND",
        headers: {
          Authorization: `Basic ${token.accessToken}`,
          Depth: "1",
          "Content-Type": "application/xml",
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
          <d:propfind xmlns:d="DAV:" xmlns:cs="urn:ietf:params:xml:ns:caldav" xmlns:ic="http://apple.com/ns/ical/">
            <d:prop>
              <d:displayname/>
              <ic:calendar-color/>
              <cs:supported-calendar-component-set/>
            </d:prop>
          </d:propfind>`,
      });

      if (!res.ok) {
        throw this.mapError(res.status);
      }

      const text = await res.text();
      return this.parseCalendarListResponse(text);
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(
        "Proton bridge unavailable",
        ProviderErrorCode.PROVIDER_UNAVAILABLE,
        "proton",
        err as Error
      );
    }
  }

  async getEvents(
    token: TokenSet,
    calendarId: string,
    _syncToken?: string | null
  ): Promise<EventDelta> {
    const baseUrl = this.getBaseUrl(token);

    try {
      // CalDAV doesn't have incremental sync tokens like Google/Outlook.
      // We always fetch all events and diff locally.
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 30);
      const timeMax = new Date();
      timeMax.setFullYear(timeMax.getFullYear() + 1);

      const res = await fetch(`${baseUrl}${calendarId}`, {
        method: "REPORT",
        headers: {
          Authorization: `Basic ${token.accessToken}`,
          Depth: "1",
          "Content-Type": "application/xml",
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
          <c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
            <d:prop>
              <d:getetag/>
              <c:calendar-data/>
            </d:prop>
            <c:filter>
              <c:comp-filter name="VCALENDAR">
                <c:comp-filter name="VEVENT">
                  <c:time-range start="${this.formatCalDAVDate(timeMin)}" end="${this.formatCalDAVDate(timeMax)}"/>
                </c:comp-filter>
              </c:comp-filter>
            </c:filter>
          </c:calendar-query>`,
      });

      if (!res.ok) {
        throw this.mapError(res.status);
      }

      const text = await res.text();
      const events = this.parseEventsResponse(text, calendarId);

      // Since we can't do incremental sync, all events are "created"
      return {
        created: events,
        updated: [],
        deleted: [],
        nextSyncToken: null,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(
        "Proton bridge unavailable",
        ProviderErrorCode.PROVIDER_UNAVAILABLE,
        "proton",
        err as Error
      );
    }
  }

  async createEvent(
    token: TokenSet,
    calendarId: string,
    event: Omit<NormalizedEvent, "id" | "sourceEventId" | "calendarId">
  ): Promise<NormalizedEvent> {
    const baseUrl = this.getBaseUrl(token);
    const uid = crypto.randomUUID();
    const ics = this.toICS(event, uid);

    const res = await fetch(`${baseUrl}${calendarId}${uid}.ics`, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${token.accessToken}`,
        "Content-Type": "text/calendar",
      },
      body: ics,
    });

    if (!res.ok) {
      throw this.mapError(res.status);
    }

    return {
      ...event,
      id: "",
      sourceEventId: uid,
      calendarId,
    };
  }

  async updateEvent(
    token: TokenSet,
    calendarId: string,
    eventId: string,
    event: Partial<Omit<NormalizedEvent, "id" | "sourceEventId" | "calendarId">>
  ): Promise<NormalizedEvent> {
    // CalDAV update = PUT with full replacement
    // For simplicity, we need to fetch the current event, merge, and PUT
    const baseUrl = this.getBaseUrl(token);

    const merged = {
      title: event.title ?? "Updated Event",
      description: event.description ?? null,
      location: event.location ?? null,
      startTime: event.startTime ?? new Date(),
      endTime: event.endTime ?? new Date(),
      allDay: event.allDay ?? false,
    };

    const ics = this.toICS(merged, eventId);

    const res = await fetch(`${baseUrl}${calendarId}${eventId}.ics`, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${token.accessToken}`,
        "Content-Type": "text/calendar",
      },
      body: ics,
    });

    if (!res.ok) {
      throw this.mapError(res.status);
    }

    return {
      ...merged,
      id: "",
      sourceEventId: eventId,
      calendarId,
    };
  }

  async deleteEvent(
    token: TokenSet,
    calendarId: string,
    eventId: string
  ): Promise<void> {
    const baseUrl = this.getBaseUrl(token);

    const res = await fetch(`${baseUrl}${calendarId}${eventId}.ics`, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${token.accessToken}`,
      },
    });

    if (!res.ok && res.status !== 404) {
      throw this.mapError(res.status);
    }
  }

  private getBaseUrl(token: TokenSet): string {
    // The base URL is stored as provider metadata.
    // For now, use a default. This would be configured per source.
    return process.env.PROTON_BRIDGE_URL || "http://127.0.0.1:1080";
  }

  private formatCalDAVDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  private toICS(
    event: Omit<NormalizedEvent, "id" | "sourceEventId" | "calendarId"> & { title: string },
    uid: string
  ): string {
    const dtStart = event.allDay
      ? `DTSTART;VALUE=DATE:${event.startTime.toISOString().split("T")[0].replace(/-/g, "")}`
      : `DTSTART:${this.formatCalDAVDate(event.startTime)}`;
    const dtEnd = event.allDay
      ? `DTEND;VALUE=DATE:${event.endTime.toISOString().split("T")[0].replace(/-/g, "")}`
      : `DTEND:${this.formatCalDAVDate(event.endTime)}`;

    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CalendarSync//EN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      dtStart,
      dtEnd,
      `SUMMARY:${event.title}`,
      event.description ? `DESCRIPTION:${event.description}` : "",
      event.location ? `LOCATION:${event.location}` : "",
      `DTSTAMP:${this.formatCalDAVDate(new Date())}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");
  }

  private parseCalendarListResponse(xml: string): NormalizedCalendar[] {
    // Simple regex-based XML parsing for CalDAV responses
    const calendars: NormalizedCalendar[] = [];
    const responseRegex = /<d:response>([\s\S]*?)<\/d:response>/gi;
    let match;

    while ((match = responseRegex.exec(xml)) !== null) {
      const block = match[1];
      const href = block.match(/<d:href>(.*?)<\/d:href>/)?.[1] || "";
      const name = block.match(/<d:displayname>(.*?)<\/d:displayname>/)?.[1] || "Unnamed";
      const color = block.match(/<ic:calendar-color>(.*?)<\/ic:calendar-color>/)?.[1] || "#7c3aed";

      if (href && href.includes("/calendars/")) {
        calendars.push({
          id: href,
          providerCalendarId: href,
          name,
          color,
          provider: Provider.PROTON,
          readOnly: false,
        });
      }
    }

    return calendars;
  }

  private parseEventsResponse(xml: string, calendarId: string): NormalizedEvent[] {
    const events: NormalizedEvent[] = [];
    const calDataRegex = /<c:calendar-data[^>]*>([\s\S]*?)<\/c:calendar-data>/gi;
    let match;

    while ((match = calDataRegex.exec(xml)) !== null) {
      const ics = match[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
      const event = this.parseVEvent(ics, calendarId);
      if (event) events.push(event);
    }

    return events;
  }

  private parseVEvent(ics: string, calendarId: string): NormalizedEvent | null {
    const uid = ics.match(/UID:(.*)/)?.[1]?.trim();
    const summary = ics.match(/SUMMARY:(.*)/)?.[1]?.trim();
    const dtStart = ics.match(/DTSTART[^:]*:(.*)/)?.[1]?.trim();
    const dtEnd = ics.match(/DTEND[^:]*:(.*)/)?.[1]?.trim();
    const description = ics.match(/DESCRIPTION:(.*)/)?.[1]?.trim();
    const location = ics.match(/LOCATION:(.*)/)?.[1]?.trim();

    if (!uid || !dtStart) return null;

    const allDay = dtStart.length === 8; // YYYYMMDD format

    return {
      id: "",
      sourceEventId: uid,
      calendarId,
      title: summary || "(No title)",
      description: description || null,
      location: location || null,
      startTime: this.parseCalDAVDate(dtStart),
      endTime: dtEnd ? this.parseCalDAVDate(dtEnd) : this.parseCalDAVDate(dtStart),
      allDay,
    };
  }

  private parseCalDAVDate(dateStr: string): Date {
    if (dateStr.length === 8) {
      // YYYYMMDD
      return new Date(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`);
    }
    // YYYYMMDDTHHmmssZ
    const formatted = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}T${dateStr.slice(9, 11)}:${dateStr.slice(11, 13)}:${dateStr.slice(13, 15)}Z`;
    return new Date(formatted);
  }

  private mapError(status: number): ProviderError {
    switch (status) {
      case 401:
        return new ProviderError("Authentication failed", ProviderErrorCode.AUTH_EXPIRED, "proton");
      case 403:
        return new ProviderError("Permission denied", ProviderErrorCode.PERMISSION_DENIED, "proton");
      case 404:
        return new ProviderError("Not found", ProviderErrorCode.NOT_FOUND, "proton");
      default:
        return new ProviderError(`CalDAV error ${status}`, ProviderErrorCode.UNKNOWN, "proton");
    }
  }
}
