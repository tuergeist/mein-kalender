import {
  CalendarProviderInterface,
  NormalizedCalendar,
  NormalizedEvent,
  EventDelta,
  TokenSet,
  Provider,
} from "../types";
import { ProviderError, ProviderErrorCode } from "../errors";

const GOOGLE_API_BASE = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export class GoogleCalendarProvider implements CalendarProviderInterface {
  constructor(
    private clientId: string,
    private clientSecret: string
  ) {}

  getConsentUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async authenticate(credentials: Record<string, string>): Promise<TokenSet> {
    const { code, redirectUri } = credentials;
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!res.ok) {
      throw this.mapError(res.status, await res.text());
    }

    const data = await res.json() as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    };
  }

  async refreshToken(token: TokenSet): Promise<TokenSet> {
    if (!token.refreshToken) {
      throw new ProviderError("No refresh token", ProviderErrorCode.AUTH_EXPIRED, "google");
    }

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: token.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      throw this.mapError(res.status, await res.text());
    }

    const data = await res.json() as any;
    return {
      accessToken: data.access_token,
      refreshToken: token.refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    };
  }

  private async fetchWithRefresh(
    url: string,
    token: TokenSet,
    options: RequestInit = {}
  ): Promise<Response> {
    let currentToken = token;

    if (currentToken.expiresAt && currentToken.expiresAt < new Date()) {
      currentToken = await this.refreshToken(currentToken);
    }

    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${currentToken.accessToken}`,
      },
    });

    if (res.status === 401) {
      currentToken = await this.refreshToken(currentToken);
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${currentToken.accessToken}`,
        },
      });
    }

    return res;
  }

  async listCalendars(token: TokenSet): Promise<NormalizedCalendar[]> {
    const res = await this.fetchWithRefresh(`${GOOGLE_API_BASE}/users/me/calendarList`, token);

    if (!res.ok) {
      throw this.mapError(res.status, await res.text());
    }

    const data = await res.json() as any;
    return (data.items || []).map((cal: Record<string, unknown>) => ({
      id: cal.id as string,
      providerCalendarId: cal.id as string,
      name: cal.summary as string,
      color: (cal.backgroundColor as string) || "#4285f4",
      provider: Provider.GOOGLE,
      readOnly: cal.accessRole === "reader" || cal.accessRole === "freeBusyReader",
    }));
  }

  async getEvents(
    token: TokenSet,
    calendarId: string,
    syncToken?: string | null,
    fetchDaysInAdvance?: number
  ): Promise<EventDelta> {
    const params = new URLSearchParams({
      maxResults: "2500",
      singleEvents: "true",
    });
    params.append("eventTypes", "default");
    params.append("eventTypes", "focusTime");
    params.append("eventTypes", "outOfOffice");
    params.append("eventTypes", "workingLocation");

    if (syncToken) {
      params.set("syncToken", syncToken);
    } else {
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 30);
      params.set("timeMin", timeMin.toISOString());
      if (fetchDaysInAdvance) {
        const timeMax = new Date();
        timeMax.setDate(timeMax.getDate() + fetchDaysInAdvance);
        params.set("timeMax", timeMax.toISOString());
      }
    }

    const res = await this.fetchWithRefresh(
      `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      token
    );

    if (res.status === 410) {
      // Sync token expired — caller should do full sync
      throw new ProviderError("Sync token expired", ProviderErrorCode.INVALID_SYNC_TOKEN, "google");
    }

    if (!res.ok) {
      throw this.mapError(res.status, await res.text());
    }

    const data = await res.json() as any;
    const created: NormalizedEvent[] = [];
    const updated: NormalizedEvent[] = [];
    const deleted: string[] = [];

    for (const item of data.items || []) {
      if (item.status === "cancelled") {
        deleted.push(item.id);
        continue;
      }

      const event = this.mapEvent(item, calendarId);

      if (syncToken) {
        updated.push(event);
      } else {
        created.push(event);
      }
    }

    return {
      created,
      updated,
      deleted,
      nextSyncToken: data.nextSyncToken ?? null,
    };
  }

  async createEvent(
    token: TokenSet,
    calendarId: string,
    event: Omit<NormalizedEvent, "id" | "sourceEventId" | "calendarId">
  ): Promise<NormalizedEvent> {
    const body = this.toGoogleEvent(event);

    const sendUpdates = event.attendees?.length ? "sendUpdates=all" : "";
    const url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events${sendUpdates ? `?${sendUpdates}` : ""}`;

    const res = await this.fetchWithRefresh(
      url,
      token,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      throw this.mapError(res.status, await res.text());
    }

    return this.mapEvent(await res.json() as any, calendarId);
  }

  async updateEvent(
    token: TokenSet,
    calendarId: string,
    eventId: string,
    event: Partial<Omit<NormalizedEvent, "id" | "sourceEventId" | "calendarId">>
  ): Promise<NormalizedEvent> {
    const body = this.toGoogleEvent(event);

    const res = await this.fetchWithRefresh(
      `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      token,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      throw this.mapError(res.status, await res.text());
    }

    return this.mapEvent(await res.json() as any, calendarId);
  }

  async deleteEvent(
    token: TokenSet,
    calendarId: string,
    eventId: string
  ): Promise<void> {
    const res = await this.fetchWithRefresh(
      `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      token,
      { method: "DELETE" }
    );

    if (!res.ok && res.status !== 410) {
      throw this.mapError(res.status, await res.text());
    }
  }

  private mapEvent(item: Record<string, unknown>, calendarId: string): NormalizedEvent {
    const start = item.start as Record<string, string>;
    const end = item.end as Record<string, string>;
    const allDay = !!start.date;

    const metadata: Record<string, unknown> = {};
    if (item.eventType) metadata.eventType = item.eventType;
    if (item.workingLocationProperties) metadata.workingLocation = item.workingLocationProperties;
    if (item.transparency) metadata.transparency = item.transparency; // "transparent" = free, "opaque" = busy

    // Normalize responseStatus from self attendee
    const attendees = item.attendees as Array<{ self?: boolean; responseStatus?: string }> | undefined;
    const selfAttendee = attendees?.find((a) => a.self);
    metadata.responseStatus = selfAttendee?.responseStatus ?? "accepted";

    // Normalize showAs from transparency
    metadata.showAs = item.transparency === "transparent" ? "free" : "busy";

    return {
      id: "",
      sourceEventId: item.id as string,
      calendarId,
      title: (item.summary as string) || "(No title)",
      description: (item.description as string) || null,
      location: (item.location as string) || null,
      startTime: new Date(start.dateTime || start.date),
      endTime: new Date(end.dateTime || end.date),
      allDay,
      providerMetadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  private toGoogleEvent(
    event: Partial<Omit<NormalizedEvent, "id" | "sourceEventId" | "calendarId">>
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {};

    if (event.title !== undefined) body.summary = event.title;
    if (event.description !== undefined) body.description = event.description;
    if (event.location !== undefined) body.location = event.location;

    if (event.startTime !== undefined) {
      body.start = event.allDay
        ? { date: event.startTime.toISOString().split("T")[0] }
        : { dateTime: event.startTime.toISOString() };
    }

    if (event.endTime !== undefined) {
      body.end = event.allDay
        ? { date: event.endTime.toISOString().split("T")[0] }
        : { dateTime: event.endTime.toISOString() };
    }

    if (event.attendees?.length) {
      body.attendees = event.attendees.map((a) => ({ email: a.email, displayName: a.name }));
    }

    if (event.sensitivity === "private") {
      body.visibility = "private";
    }

    return body;
  }

  private mapError(status: number, body: string): ProviderError {
    switch (status) {
      case 401:
        return new ProviderError("Authentication expired", ProviderErrorCode.AUTH_EXPIRED, "google");
      case 403:
        return new ProviderError("Permission denied", ProviderErrorCode.PERMISSION_DENIED, "google");
      case 404:
        return new ProviderError("Not found", ProviderErrorCode.NOT_FOUND, "google");
      case 429:
        return new ProviderError("Rate limited", ProviderErrorCode.RATE_LIMITED, "google");
      default:
        return new ProviderError(`Google API error ${status}: ${body}`, ProviderErrorCode.UNKNOWN, "google");
    }
  }
}
