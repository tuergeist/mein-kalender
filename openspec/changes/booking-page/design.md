## Context

The app is a Next.js frontend + Fastify backend with Prisma/PostgreSQL. Auth is JWT-based via NextAuth. All routes under `/calendar`, `/settings`, `/profile` are protected by middleware. Calendar events are synced from Google/Outlook/Proton/ICS and stored in the `Event` model with `startTime`/`endTime` indexes.

The booking page needs a **public** route that doesn't require authentication but can compute availability from a user's private calendar data.

## Goals / Non-Goals

**Goals:**
- Calendly/Zeeg-style public booking page
- Event types with configurable duration, name, description, location
- Availability from working hours + calendar busy times
- Simple booking form (name, email, notes)
- Created bookings appear on the user's calendar
- User can view and cancel bookings

**Non-Goals (MVP):**
- Video conferencing auto-creation (Google Meet, Zoom) — user pastes a static link for now
- Recurring availability exceptions (e.g., "unavailable Dec 24-31")
- Team/round-robin scheduling
- Payment integration
- Custom booking form fields beyond name/email/notes
- Email confirmations (can be added later)
- Buffer time between bookings (can be added later)

## Decisions

### 1. Data Model

**EventType** — defines what can be booked:
- `id`, `userId`, `slug` (unique per user), `name`, `durationMinutes`, `description`, `location`, `color`, `enabled`, `createdAt`
- Slug is used in the public URL: `/book/<username>/<slug>`

**AvailabilityRule** — per-user working hours:
- `id`, `userId`, `dayOfWeek` (0=Sun..6=Sat), `startTime` (e.g. "09:00"), `endTime` (e.g. "17:00"), `enabled`
- One row per day. Disabled days = not available.
- Default: Mon-Fri 09:00-17:00

**Booking** — confirmed bookings:
- `id`, `eventTypeId`, `userId` (the host), `guestName`, `guestEmail`, `notes`, `startTime`, `endTime`, `status` (confirmed/cancelled), `createdAt`
- No FK to `Event` — the booking creates a provider event, but we store the provider event ID for cancellation.
- `providerEventId` — the event ID on the host's calendar provider

### 2. Username for public URL

The `User` model currently has no `username` field. We add a `username String? @unique` field. Users set it in settings. The public booking URL is `/book/<username>/<event-type-slug>`.

Alternative considered: using `userId` in the URL — rejected because it's ugly and not memorable.

### 3. Availability calculation (server-side)

The public API endpoint `GET /api/public/book/<username>/<slug>/slots?date=YYYY-MM-DD` returns available time slots for a given date:

1. Load the user's `AvailabilityRule` for that day of week → get working hours window
2. Load all events from the user's enabled calendars for that date (same query pattern as `/api/events`)
3. Filter out free/transparent events (only busy events block slots)
4. Load existing bookings for that date
5. Subtract busy events and existing bookings from the working hours window
6. Divide remaining free time into slots of `eventType.durationMinutes`
7. Return slot start times

This runs server-side on the backend — no calendar tokens are exposed to the public.

### 4. Public routes bypass auth

New Fastify route group registered **without** the `authenticate` preHandler:
- `GET /api/public/book/:username/:slug` — event type info
- `GET /api/public/book/:username/:slug/slots` — available slots for a date
- `POST /api/public/book/:username/:slug` — create a booking

The Next.js middleware already only protects specific paths. `/book/*` is not in the protected list.

### 5. Booking creates a calendar event

When a booking is confirmed, the backend:
1. Creates a `Booking` record
2. Finds the user's target calendar (or first writable calendar)
3. Creates an event via the provider API with title like "[Booking] Guest Name — Event Type"
4. Stores the `providerEventId` on the Booking for later cancellation

### 6. Frontend pages

- `/book/[username]/[slug]` — public booking page (no auth required)
  - Left panel: event type info (name, duration, location, description)
  - Right panel: month calendar picker → time slot list → booking form
- `/bookings` — authenticated, lists upcoming bookings with cancel option
- `/settings` — new section for event types + availability rules + username

## Risks / Trade-offs

- **No real-time availability**: Slots are computed from last-synced events. If the user's calendar changes between syncs, a slot might show as available when it's not. Mitigation: re-check at booking creation time.
- **No email confirmation**: MVP skips email. The booking appears on the calendar, which is the primary notification channel.
- **Username uniqueness**: Users must claim a username. First-come-first-served. No fancy validation beyond alphanumeric + hyphens.
