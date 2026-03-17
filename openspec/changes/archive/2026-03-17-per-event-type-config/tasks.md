## 1. Database

- [x] 1.1 Add `bookingCalendarEntryId String?` to `EventType` model
- [x] 1.2 Add `eventTypeId String?` FK to `AvailabilityRule`, add relation to EventType
- [x] 1.3 Change AvailabilityRule unique constraint from `[userId, dayOfWeek]` to `[userId, eventTypeId, dayOfWeek]`
- [x] 1.4 Regenerate Prisma client

## 2. Backend — Per-type config

- [x] 2.1 Update `GET /api/event-types` to include `bookingCalendarEntryId` and `availabilityRules` per type
- [x] 2.2 Update `PUT /api/event-types/:id` to accept `bookingCalendarEntryId` and `availabilityRules` array (upsert 7 rules with eventTypeId)
- [x] 2.3 Update `POST /api/event-types` to accept `bookingCalendarEntryId`
- [x] 2.4 Update `computeSlots` in `public-booking.ts`: load event-type-specific rules first, fall back to user defaults
- [x] 2.5 Update booking creation in `public-booking.ts`: use `eventType.bookingCalendarEntryId` → user fallback → target → first writable

## 3. Backend — Availability preview

- [x] 3.1 Create `GET /api/event-types/:id/availability-preview?week=YYYY-MM-DD` endpoint
- [x] 3.2 Return 7 days with: working hours, busy blocks (title + calendar name + color), bookings (guest name), available slots
- [x] 3.3 Reuse/refactor `computeSlots` logic to also return the breakdown

## 4. Frontend — Event type edit

- [x] 4.1 Add booking calendar selector (dropdown) to event type edit modal
- [x] 4.2 Add "Custom working hours" toggle + 7-day schedule editor (start collapsed)
- [x] 4.3 Load and display per-type availability rules; show user defaults when no custom rules
- [x] 4.4 Send `bookingCalendarEntryId` and `availabilityRules` in create/update requests

## 5. Frontend — Availability preview

- [x] 5.1 Create availability preview component: week view with colored time blocks
- [x] 5.2 Show working hours (gray outside), busy events (colored by calendar), bookings (orange), free slots (green)
- [x] 5.3 Week navigation (prev/next)
- [x] 5.4 Add "Preview availability" button/link in event type settings
