## 1. Database Schema

- [x] 1.1 Add `username String? @unique` to the `User` model
- [x] 1.2 Create `EventType` model (id, userId, slug, name, durationMinutes, description, location, color, enabled, createdAt)
- [x] 1.3 Create `AvailabilityRule` model (id, userId, dayOfWeek, startTime, endTime, enabled)
- [x] 1.4 Create `Booking` model (id, eventTypeId, userId, guestName, guestEmail, notes, startTime, endTime, status, providerEventId, createdAt)
- [x] 1.5 Regenerate Prisma client

## 2. Backend API — Event Types

- [x] 2.1 Create `routes/event-types.ts` with CRUD endpoints: GET/POST/PUT/DELETE `/api/event-types`
- [x] 2.2 Auto-generate slug from name, ensure uniqueness per user
- [x] 2.3 Register routes in server.ts

## 3. Backend API — Availability

- [x] 3.1 Create `routes/availability.ts`: GET/PUT `/api/availability` (get/set all 7 day rules at once)
- [x] 3.2 Seed default Mon-Fri 09:00-17:00 rules when user first accesses availability
- [x] 3.3 Register routes in server.ts

## 4. Backend API — Public Booking

- [x] 4.1 Create `routes/public-booking.ts` (NO auth middleware)
- [x] 4.2 `GET /api/public/book/:username/:slug` — return event type info
- [x] 4.3 `GET /api/public/book/:username/:slug/slots?date=YYYY-MM-DD` — compute available slots
- [x] 4.4 Implement slot computation: load working hours → load busy events → load existing bookings → subtract → divide into duration-sized slots
- [x] 4.5 `POST /api/public/book/:username/:slug` — create booking, create calendar event on host's calendar, return confirmation
- [x] 4.6 Re-check slot availability at booking creation time (prevent double-booking)
- [x] 4.7 Register routes in server.ts (without auth hook)

## 5. Backend API — Booking Management

- [x] 5.1 Create `routes/bookings.ts`: GET `/api/bookings` (list), DELETE `/api/bookings/:id` (cancel)
- [x] 5.2 On cancel: update status to "cancelled", delete provider event if future booking
- [x] 5.3 Register routes in server.ts

## 6. Backend API — Username

- [x] 6.1 Add PUT `/api/profile/username` to set username (validate format: lowercase alphanumeric + hyphens, check uniqueness)
- [x] 6.2 Add GET `/api/profile` to return user info including username

## 7. Frontend — Public Booking Page

- [x] 7.1 Create `/book/[username]/[slug]/page.tsx` (public, no auth)
- [x] 7.2 Left panel: event type info (name, duration, location, description)
- [x] 7.3 Right panel: month calendar picker (highlight available days, gray out past/unavailable)
- [x] 7.4 Time slot list for selected date (fetched from slots API)
- [x] 7.5 Booking form (name, email, notes) with validation
- [x] 7.6 Confirmation view after successful booking

## 8. Frontend — Booking Management

- [x] 8.1 Create `/bookings/page.tsx` (authenticated) listing upcoming bookings
- [x] 8.2 Cancel button per booking with confirmation
- [x] 8.3 Add "Bookings" link to AppShell navigation

## 9. Frontend — Settings (Event Types + Availability + Username)

- [x] 9.1 Add username field to settings page (or profile page)
- [x] 9.2 Event types management section: list, create, edit, delete, enable/disable
- [x] 9.3 Availability editor: 7-day grid with start/end time inputs and enable toggles
- [x] 9.4 Show public booking URL for each enabled event type

## 10. Auth & Middleware

- [x] 10.1 Ensure `/book/*` routes are NOT protected by Next.js middleware
- [x] 10.2 Ensure public API routes `/api/public/*` are registered without auth preHandler in Fastify
