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

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";
const MS_TOKEN_URL = "https://login.microsoftonline.com";

export class OutlookCalendarProvider implements CalendarProviderInterface {
  constructor(
    private clientId: string,
    private clientSecret: string,
    private tenantId: string = "common"
  ) {}

  getConsentUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "Calendars.ReadWrite offline_access",
      state,
    });
    return `${MS_TOKEN_URL}/${this.tenantId}/oauth2/v2.0/authorize?${params}`;
  }

  async authenticate(credentials: Record<string, string>): Promise<TokenSet> {
    const { code, redirectUri } = credentials;
    const res = await fetch(`${MS_TOKEN_URL}/${this.tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: "Calendars.ReadWrite offline_access",
      }),
    });

    if (!res.ok) {
      throw this.mapError(res.status, await res.text());
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    };
  }

  async refreshToken(token: TokenSet): Promise<TokenSet> {
    if (!token.refreshToken) {
      throw new ProviderError("No refresh token", ProviderErrorCode.AUTH_EXPIRED, "outlook");
    }

    const res = await fetch(`${MS_TOKEN_URL}/${this.tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: token.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "refresh_token",
        scope: "Calendars.ReadWrite offline_access",
      }),
    });

    if (!res.ok) {
      throw this.mapError(res.status, await res.text());
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
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
    const res = await this.fetchWithRefresh(`${GRAPH_API_BASE}/me/calendars`, token);

    if (!res.ok) {
      throw this.mapError(res.status, await res.text());
    }

    const data = await res.json();
    return (data.value || []).map((cal: Record<string, unknown>) => ({
      id: cal.id as string,
      providerCalendarId: cal.id as string,
      name: cal.name as string,
      color: this.mapOutlookColor(cal.color as string),
      provider: Provider.OUTLOOK,
      readOnly: !cal.canEdit,
    }));
  }

  async getEvents(
    token: TokenSet,
    calendarId: string,
    syncToken?: string | null
  ): Promise<EventDelta> {
    let url: string;

    if (syncToken) {
      url = syncToken; // deltaToken is a full URL for Graph API
    } else {
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 30);
      url = `${GRAPH_API_BASE}/me/calendars/${calendarId}/calendarView/delta?startDateTime=${timeMin.toISOString()}&endDateTime=${new Date(Date.now() + 365 * 86400000).toISOString()}`;
    }

    const created: NormalizedEvent[] = [];
    const updated: NormalizedEvent[] = [];
    const deleted: string[] = [];
    let nextDeltaLink: string | null = null;

    // Follow pagination
    let currentUrl: string | null = url;
    while (currentUrl) {
      const res = await this.fetchWithRefresh(currentUrl, token);

      if (!res.ok) {
        throw this.mapError(res.status, await res.text());
      }

      const data = await res.json();

      for (const item of data.value || []) {
        if (item["@removed"]) {
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

      currentUrl = data["@odata.nextLink"] ?? null;
      if (data["@odata.deltaLink"]) {
        nextDeltaLink = data["@odata.deltaLink"];
      }
    }

    return { created, updated, deleted, nextSyncToken: nextDeltaLink };
  }

  async createEvent(
    token: TokenSet,
    calendarId: string,
    event: Omit<NormalizedEvent, "id" | "sourceEventId" | "calendarId">
  ): Promise<NormalizedEvent> {
    const body = this.toGraphEvent(event);

    const res = await this.fetchWithRefresh(
      `${GRAPH_API_BASE}/me/calendars/${calendarId}/events`,
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

    return this.mapEvent(await res.json(), calendarId);
  }

  async updateEvent(
    token: TokenSet,
    calendarId: string,
    eventId: string,
    event: Partial<Omit<NormalizedEvent, "id" | "sourceEventId" | "calendarId">>
  ): Promise<NormalizedEvent> {
    const body = this.toGraphEvent(event);

    const res = await this.fetchWithRefresh(
      `${GRAPH_API_BASE}/me/events/${eventId}`,
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

    return this.mapEvent(await res.json(), calendarId);
  }

  async deleteEvent(
    token: TokenSet,
    calendarId: string,
    eventId: string
  ): Promise<void> {
    const res = await this.fetchWithRefresh(
      `${GRAPH_API_BASE}/me/events/${eventId}`,
      token,
      { method: "DELETE" }
    );

    if (!res.ok && res.status !== 404) {
      throw this.mapError(res.status, await res.text());
    }
  }

  private mapEvent(item: Record<string, unknown>, calendarId: string): NormalizedEvent {
    const start = item.start as Record<string, string>;
    const end = item.end as Record<string, string>;
    const allDay = item.isAllDay as boolean;

    return {
      id: "",
      sourceEventId: item.id as string,
      calendarId,
      title: (item.subject as string) || "(No title)",
      description: ((item.body as Record<string, string>)?.content) || null,
      location: ((item.location as Record<string, string>)?.displayName) || null,
      startTime: new Date(start.dateTime + (start.timeZone === "UTC" ? "Z" : "")),
      endTime: new Date(end.dateTime + (end.timeZone === "UTC" ? "Z" : "")),
      allDay,
    };
  }

  private toGraphEvent(
    event: Partial<Omit<NormalizedEvent, "id" | "sourceEventId" | "calendarId">>
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {};

    if (event.title !== undefined) body.subject = event.title;
    if (event.description !== undefined) {
      body.body = { contentType: "text", content: event.description || "" };
    }
    if (event.location !== undefined) {
      body.location = { displayName: event.location || "" };
    }
    if (event.allDay !== undefined) body.isAllDay = event.allDay;

    if (event.startTime !== undefined) {
      body.start = { dateTime: event.startTime.toISOString(), timeZone: "UTC" };
    }
    if (event.endTime !== undefined) {
      body.end = { dateTime: event.endTime.toISOString(), timeZone: "UTC" };
    }

    return body;
  }

  private mapOutlookColor(color: string): string {
    const colorMap: Record<string, string> = {
      auto: "#0078d4",
      lightBlue: "#71afe5",
      lightGreen: "#7ed321",
      lightOrange: "#ff8c00",
      lightGray: "#a0a0a0",
      lightYellow: "#ffd700",
      lightTeal: "#00b7c3",
      lightPink: "#e3008c",
      lightBrown: "#8b572a",
      lightRed: "#d13438",
      maxColor: "#0078d4",
    };
    return colorMap[color] || "#0078d4";
  }

  private mapError(status: number, body: string): ProviderError {
    switch (status) {
      case 401:
        return new ProviderError("Authentication expired", ProviderErrorCode.AUTH_EXPIRED, "outlook");
      case 403:
        return new ProviderError("Permission denied", ProviderErrorCode.PERMISSION_DENIED, "outlook");
      case 404:
        return new ProviderError("Not found", ProviderErrorCode.NOT_FOUND, "outlook");
      case 429:
        return new ProviderError("Rate limited", ProviderErrorCode.RATE_LIMITED, "outlook");
      default:
        return new ProviderError(`Graph API error ${status}: ${body}`, ProviderErrorCode.UNKNOWN, "outlook");
    }
  }
}
