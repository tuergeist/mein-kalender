## Context

Events from all providers are stored locally in the `Event` model with `startTime`, `endTime`, `title`, `description`, `location`, `allDay`, `providerMetadata`. The calendar view tracks which calendars are visible via `localStorage("visibleCalendarIds")`.

## Goals / Non-Goals

**Goals:**
- Create subscribable ICS feeds from any combination of calendars
- Two modes: full details (title, description, location) vs. free/busy only (just BUSY blocks)
- Configurable days in advance (30/60/90)
- Token-based URL for subscription from external tools
- Quick creation from calendar view with current visible calendars

**Non-Goals:**
- Real-time push (ICS subscription is pull-based, external tool polls)
- CalDAV server (just static ICS generation)
- Feed sharing between users

## Decisions

### 1. IcsFeed model

```
IcsFeed {
  id, userId, name, token (unique, auto-generated),
  mode ("full" | "freebusy"), daysInAdvance (default 30),
  createdAt
}
```

Plus a many-to-many relation `IcsFeed <-> CalendarEntry` for which calendars to include.

The `token` is a crypto-random string (e.g., 32 chars) used in the URL. No login required — the token IS the auth.

### 2. ICS generation endpoint

`GET /api/ics-feed/:token.ics` — no auth middleware. Looks up the feed by token, loads events from the selected calendars for the configured date range, generates a VCALENDAR with VEVENT entries.

For `freebusy` mode: events are emitted as `FREEBUSY` periods or as events with only `DTSTART`/`DTEND` and a generic title like "Busy".

### 3. ICS format

Standard iCalendar format:
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//mein-kalender//EN
BEGIN:VEVENT
UID:<sourceEventId>@mein-kalender
DTSTART:20260320T090000Z
DTEND:20260320T100000Z
SUMMARY:Meeting
DESCRIPTION:...
LOCATION:...
END:VEVENT
...
END:VCALENDAR
```

### 4. UI placement

- **Calendar view toolbar**: "Export ICS" button → opens modal with feed configuration (pre-selects visible calendars)
- **Sync page or settings**: Feed management section listing existing feeds with copy-URL buttons
- **Feed creation modal**: Name, mode (full/freebusy), days in advance, calendar selection

## Risks / Trade-offs

- **Stale data**: ICS content reflects last sync state. If provider sync is delayed, the ICS feed is also delayed. This is expected and documented.
- **Token security**: Anyone with the URL can access the feed. Tokens should be long enough to prevent guessing. Users can regenerate or delete feeds.
