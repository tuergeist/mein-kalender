## Context

Current state:
- `AvailabilityRule` has `userId` + `dayOfWeek` (unique). One schedule per user.
- `User.bookingCalendarEntryId` — global booking calendar for all event types.
- `EventType.calendars` — per-type conflict calendar selection (already done).
- `computeSlots()` in `public-booking.ts` loads the user's single availability schedule.

## Goals / Non-Goals

**Goals:**
- Per-event-type working hours (7-day schedule)
- Per-event-type booking calendar
- Visual availability preview for debugging
- Fall back to user defaults when event type has no custom schedule

**Non-Goals:**
- Named/reusable schedules (e.g., "Work", "Evening") — can be added later
- Buffer time between bookings
- Date-specific overrides (e.g., holidays)

## Decisions

### 1. AvailabilityRule gets optional eventTypeId

Add `eventTypeId String?` to `AvailabilityRule`. Change unique constraint from `[userId, dayOfWeek]` to `[userId, eventTypeId, dayOfWeek]` (with eventTypeId nullable — Prisma handles this with `@@unique`).

- Rules where `eventTypeId = null` → user's default schedule (existing behavior)
- Rules where `eventTypeId = X` → override schedule for event type X

`computeSlots()` loads rules for the specific event type first, falls back to user defaults if none exist.

### 2. BookingCalendarEntryId moves to EventType

Add `bookingCalendarEntryId String?` to `EventType`. Keep `User.bookingCalendarEntryId` as the global fallback.

When creating a booking event:
1. Use `eventType.bookingCalendarEntryId` if set
2. Fall back to `user.bookingCalendarEntryId`
3. Fall back to target calendar or first writable

### 3. Availability preview API

`GET /api/event-types/:id/availability-preview?week=YYYY-MM-DD`

Returns a week's data:
```json
{
  "days": [
    {
      "date": "2026-03-17",
      "workingHours": { "start": "09:00", "end": "17:00", "enabled": true },
      "busyBlocks": [
        { "start": "10:00", "end": "11:00", "title": "Team standup", "calendar": "Work", "color": "#3b82f6" }
      ],
      "bookings": [
        { "start": "14:00", "end": "14:30", "guestName": "Max" }
      ],
      "availableSlots": ["09:00", "09:30", "11:00", "11:30", ...]
    },
    ...
  ]
}
```

This is the same computation as `computeSlots` but returns the breakdown (working hours, busy events, bookings) instead of just the final slot list.

### 4. Availability preview UI

New page at `/settings/booking/[id]/preview` or inline expandable section in the event type edit view. Shows a week view with:
- Gray background = outside working hours
- Colored blocks = busy events (color from source calendar)
- Orange blocks = existing bookings
- Green = available slots
- Tooltip or sidebar showing what's blocking each period

## Risks / Trade-offs

- **Migration complexity**: Changing the AvailabilityRule unique constraint requires a migration that drops and recreates it. Existing rules all have `eventTypeId = null` so they'll still be unique.
- **Per-type schedule UI**: 7-day editor in the event type modal might be heavy. Can start collapsed with "Customize working hours" toggle.
