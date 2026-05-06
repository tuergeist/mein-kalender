import {
  CalendarProviderInterface,
  NormalizedCalendar,
  NormalizedEvent,
  EventDelta,
  TokenSet,
  Provider,
} from "../types";

function stripHtml(html: string | undefined | null): string | null {
  if (!html) return null;
  // Remove style/script tags and their content, then strip remaining tags
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}
import { ProviderError, ProviderErrorCode } from "../errors";
import { fetchWithTransportRetry } from "../lib/transport-retry";

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";
const MS_TOKEN_URL = "https://login.microsoftonline.com";

const MAX_RETRY_AFTER_SEC = 60;

// Parses a Retry-After header value (seconds-integer or HTTP-date) into seconds.
// Returns 0 for missing/unparseable values.
function parseRetryAfter(header: string | null): number {
  if (!header) return 0;
  const asInt = Number(header);
  if (Number.isFinite(asInt) && asInt >= 0) return Math.ceil(asInt);
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  return 0;
}

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

    const data = await res.json() as any;
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

    const data = await res.json() as any;
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

    const doFetch = (t: TokenSet) =>
      fetchWithTransportRetry(() =>
        fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${t.accessToken}`,
          },
        })
      );

    let res = await doFetch(currentToken);

    if (res.status === 401) {
      currentToken = await this.refreshToken(currentToken);
      res = await doFetch(currentToken);
    }

    if (res.status === 429) {
      const retryAfterSec = parseRetryAfter(res.headers.get("Retry-After"));
      if (retryAfterSec > 0 && retryAfterSec <= MAX_RETRY_AFTER_SEC) {
        await new Promise((r) => setTimeout(r, retryAfterSec * 1000));
        res = await doFetch(currentToken);
      }
    }

    return res;
  }

  async listCalendars(token: TokenSet): Promise<NormalizedCalendar[]> {
    const res = await this.fetchWithRefresh(`${GRAPH_API_BASE}/me/calendars`, token);

    if (!res.ok) {
      throw this.mapError(res.status, await res.text());
    }

    const data = await res.json() as any;
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
    syncToken?: string | null,
    fetchDaysInAdvance?: number
  ): Promise<EventDelta> {
    if (syncToken) {
      return this.getDeltaEvents(token, calendarId, syncToken);
    }
    return this.getFullEvents(token, calendarId, fetchDaysInAdvance);
  }

  // Full sync: use calendarView (not delta) to get complete event data
  private async getFullEvents(
    token: TokenSet,
    calendarId: string,
    fetchDaysInAdvance?: number
  ): Promise<EventDelta> {
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 30);
    const daysAhead = fetchDaysInAdvance || 90;
    const timeMax = new Date(Date.now() + daysAhead * 86400000);

    const created: NormalizedEvent[] = [];
    let currentUrl: string | null =
      `${GRAPH_API_BASE}/me/calendars/${calendarId}/calendarView?startDateTime=${timeMin.toISOString()}&endDateTime=${timeMax.toISOString()}&$top=100&$select=id,subject,body,start,end,location,isAllDay,showAs,responseStatus,type,categories,isCancelled`;

    while (currentUrl) {
      const res = await this.fetchWithRefresh(currentUrl, token);
      if (!res.ok) throw this.mapError(res.status, await res.text());

      const data = await res.json() as any;
      for (const item of data.value || []) {
        if (item.isCancelled) continue;
        created.push(this.mapEvent(item, calendarId));
      }
      currentUrl = data["@odata.nextLink"] ?? null;
    }

    // Now get a delta token for future incremental syncs
    const deltaUrl = `${GRAPH_API_BASE}/me/calendars/${calendarId}/calendarView/delta?startDateTime=${timeMin.toISOString()}&endDateTime=${new Date(Date.now() + daysAhead * 86400000).toISOString()}&$select=id,subject,body,start,end,location,isAllDay,showAs,responseStatus,type,categories,isCancelled`;
    let nextDeltaLink: string | null = null;
    let deltaPageUrl: string | null = deltaUrl;
    while (deltaPageUrl) {
      const res = await this.fetchWithRefresh(deltaPageUrl, token);
      if (!res.ok) break; // non-fatal, we just won't have a delta token
      const data = await res.json() as any;
      deltaPageUrl = data["@odata.nextLink"] ?? null;
      if (data["@odata.deltaLink"]) nextDeltaLink = data["@odata.deltaLink"];
    }

    return { created, updated: [], deleted: [], nextSyncToken: nextDeltaLink };
  }

  // Incremental sync: use calendarView/delta with sync token
  private async getDeltaEvents(
    token: TokenSet,
    calendarId: string,
    syncToken: string
  ): Promise<EventDelta> {
    const updated: NormalizedEvent[] = [];
    const deleted: string[] = [];
    let nextDeltaLink: string | null = null;

    let currentUrl: string | null = syncToken;
    while (currentUrl) {
      const res = await this.fetchWithRefresh(currentUrl, token);
      if (!res.ok) throw this.mapError(res.status, await res.text());

      const data = await res.json() as any;
      for (const item of data.value || []) {
        if (item["@removed"] || item.isCancelled) {
          deleted.push(item.id);
          continue;
        }
        updated.push(this.mapEvent(item, calendarId));
      }

      currentUrl = data["@odata.nextLink"] ?? null;
      if (data["@odata.deltaLink"]) nextDeltaLink = data["@odata.deltaLink"];
    }

    return { created: [], updated, deleted, nextSyncToken: nextDeltaLink };
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

    return this.mapEvent(await res.json() as any, calendarId);
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

    return this.mapEvent(await res.json() as any, calendarId);
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

  // Returns just the event IDs in [startDate, endDate). No delta state, no body.
  // Used for windowed orphan cleanup to detect deletions the delta sync missed.
  async listEventIdsInRange(
    token: TokenSet,
    calendarId: string,
    startDate: Date,
    endDate: Date
  ): Promise<string[]> {
    const ids: string[] = [];
    let currentUrl: string | null =
      `${GRAPH_API_BASE}/me/calendars/${calendarId}/calendarView?startDateTime=${startDate.toISOString()}&endDateTime=${endDate.toISOString()}&$top=200&$select=id,isCancelled`;

    while (currentUrl) {
      const res = await this.fetchWithRefresh(currentUrl, token);
      if (!res.ok) throw this.mapError(res.status, await res.text());
      const data = await res.json() as any;
      for (const item of data.value || []) {
        if (item.isCancelled) continue;
        ids.push(item.id);
      }
      currentUrl = data["@odata.nextLink"] ?? null;
    }
    return ids;
  }

  private mapEvent(item: Record<string, unknown>, calendarId: string): NormalizedEvent {
    const start = item.start as Record<string, string>;
    const end = item.end as Record<string, string>;
    const allDay = item.isAllDay as boolean;

    // Normalize responseStatus
    const responseMap: Record<string, string> = {
      organizer: "accepted",
      accepted: "accepted",
      declined: "declined",
      tentativelyAccepted: "tentative",
      none: "needsAction",
      notResponded: "needsAction",
    };
    const rawResponse = (item.responseStatus as Record<string, string>)?.response ?? "none";
    const responseStatus = responseMap[rawResponse] ?? "needsAction";

    // Normalize showAs
    const showAsMap: Record<string, string> = {
      free: "free",
      tentative: "tentative",
      busy: "busy",
      oof: "busy",
      workingElsewhere: "busy",
      unknown: "busy",
    };
    const rawShowAs = item.showAs as string | undefined;
    const showAs = showAsMap[rawShowAs ?? "busy"] ?? "busy";

    const metadata: Record<string, unknown> = { responseStatus, showAs };
    if (item.categories) metadata.categories = item.categories;
    if (item.type) metadata.outlookType = item.type;

    // Better fallback titles for Outlook events without a subject.
    // IMPORTANT: The Graph API delta endpoint may omit "subject" entirely
    // when it hasn't changed. We must distinguish between:
    //   - subject missing from response (delta didn't include it) → keep existing title
    //   - subject present but empty string → genuine no-title event
    // subject can be: present with value, present but empty/null/undefined, or absent entirely
    const subjectPresent = "subject" in item && item.subject != null && item.subject !== "";
    let title = typeof item.subject === "string" ? item.subject.trim() : "";
    if (!title && subjectPresent) {
      // subject key exists but trimmed to empty — shouldn't happen, but guard
      title = "(No title)";
    }
    if (!title && !subjectPresent && "subject" in item) {
      // subject key exists but is null/undefined/empty — genuine no-title event
      if (rawShowAs === "oof") title = "Out of Office";
      else if (rawShowAs === "workingElsewhere") title = "Working Elsewhere";
      else if (rawShowAs === "free") title = "Free";
      else if (rawShowAs === "tentative") title = "Tentative";
      else title = "(No title)";
    }
    if (!("subject" in item)) {
      // subject entirely absent from response — delta didn't include it
      metadata._subjectMissing = true;
      title = "(No title)";  // placeholder, sync-job will skip overwriting
    }
    if (!("body" in item)) {
      metadata._bodyMissing = true;
    }
    if (!("location" in item)) {
      metadata._locationMissing = true;
    }

    return {
      id: "",
      sourceEventId: item.id as string,
      calendarId,
      title,
      description: stripHtml((item.body as Record<string, string>)?.content) || null,
      location: ((item.location as Record<string, string>)?.displayName) || null,
      startTime: new Date(start.dateTime + (start.timeZone === "UTC" ? "Z" : "")),
      endTime: new Date(end.dateTime + (end.timeZone === "UTC" ? "Z" : "")),
      allDay,
      providerMetadata: metadata,
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

    if (event.attendees?.length) {
      body.attendees = event.attendees.map((a) => ({
        emailAddress: { address: a.email, name: a.name || a.email },
        type: "required",
      }));
    }

    if (event.sensitivity) {
      body.sensitivity = event.sensitivity;
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
