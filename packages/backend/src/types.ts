export enum Provider {
  GOOGLE = "google",
  OUTLOOK = "outlook",
  ICS = "ics",
}

export enum SyncStatus {
  OK = "ok",
  SYNCING = "syncing",
  ERROR = "error",
}

export interface NormalizedCalendar {
  id: string;
  providerCalendarId: string;
  name: string;
  color: string;
  provider: Provider;
  readOnly: boolean;
}

export interface NormalizedEvent {
  id: string;
  sourceEventId: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  providerMetadata?: Record<string, unknown>;
  attendees?: Array<{ email: string; name?: string }>;
}

export interface EventDelta {
  created: NormalizedEvent[];
  updated: NormalizedEvent[];
  deleted: string[]; // sourceEventIds
  nextSyncToken: string | null;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

export interface CalendarProviderInterface {
  getConsentUrl?(redirectUri: string, state: string): string;
  authenticate(credentials: Record<string, string>): Promise<TokenSet>;
  listCalendars(token: TokenSet): Promise<NormalizedCalendar[]>;
  getEvents(
    token: TokenSet,
    calendarId: string,
    syncToken?: string | null,
    fetchDaysInAdvance?: number
  ): Promise<EventDelta>;
  createEvent(
    token: TokenSet,
    calendarId: string,
    event: Omit<NormalizedEvent, "id" | "sourceEventId" | "calendarId">
  ): Promise<NormalizedEvent>;
  updateEvent(
    token: TokenSet,
    calendarId: string,
    eventId: string,
    event: Partial<Omit<NormalizedEvent, "id" | "sourceEventId" | "calendarId">>
  ): Promise<NormalizedEvent>;
  deleteEvent(
    token: TokenSet,
    calendarId: string,
    eventId: string
  ): Promise<void>;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
}
