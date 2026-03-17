## 1. Database

- [x] 1.1 Add `sourceCalendars CalendarEntry[] @relation("TargetSyncCalendars")` to `CalendarEntry` and the inverse relation
- [x] 1.2 Add `calendars CalendarEntry[] @relation("EventTypeCalendars")` to `EventType` and the inverse relation on `CalendarEntry`
- [x] 1.3 Regenerate Prisma client

## 2. Backend — Target Sync

- [x] 2.1 Update `PUT /api/target-calendar` to accept optional `sourceCalendarEntryIds` string array and `set` the relation
- [x] 2.2 Update `GET /api/target-calendar` to include `sourceCalendars` (id + name) in the response
- [x] 2.3 Update `cloneToTarget` in `sync-job.ts`: if `targetEntry.sourceCalendars` is non-empty, filter events by those calendar entry IDs; otherwise keep current behavior

## 3. Backend — Booking Availability

- [x] 3.1 Update `PUT /api/event-types/:id` to accept optional `calendarEntryIds` string array and `set` the relation
- [x] 3.2 Update `GET /api/event-types` to include `calendars` (id + name) in the response
- [x] 3.3 Update `computeSlots` in `public-booking.ts`: if event type has calendars, filter busy events by those IDs; otherwise keep current behavior

## 4. Frontend — Target Calendar Settings

- [x] 4.1 Load all calendar entries (all sources, including read-only) for the multi-select
- [x] 4.2 Add checkbox list to the target calendar settings card showing which source calendars to sync
- [x] 4.3 Include `sourceCalendarEntryIds` in the save request

## 5. Frontend — Event Type Edit

- [x] 5.1 Load calendar entries for the multi-select in the event type edit modal
- [x] 5.2 Add checkbox list to the event type edit modal for calendar selection
- [x] 5.3 Include `calendarEntryIds` in the event type create and update requests
