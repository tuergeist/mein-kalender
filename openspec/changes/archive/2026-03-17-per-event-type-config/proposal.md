## Why

Event types have different contexts — a work consultation should book into the work calendar during business hours, while a personal coaching session should book into a personal calendar during evening hours. Currently booking calendar and working hours are global. Users need per-event-type control over all booking parameters.

## What Changes

- **Booking calendar per event type**: Move `bookingCalendarEntryId` from User to EventType. Each event type specifies which calendar to create the booking event in.
- **Working hours per event type**: Each event type gets its own 7-day availability schedule. The `AvailabilityRule` model gains an optional `eventTypeId` FK. Rules with `eventTypeId = null` are the user's defaults; rules with an `eventTypeId` override for that event type.
- **Conflict calendars**: Already implemented per event type (the `calendars` relation on EventType).
- **Availability visualization**: New API endpoint and UI component showing a weekly view of why/where time is blocked or available for a specific event type. Shows working hours, busy events (colored by source calendar), existing bookings, and computed free slots.

## Capabilities

### New Capabilities
- `per-event-type-schedule`: Per-event-type working hours and booking calendar
- `availability-preview`: Visual debug view of availability for an event type

### Modified Capabilities
_(none)_

## Impact

- **Database**: Add `eventTypeId` to `AvailabilityRule` (nullable FK), add `bookingCalendarEntryId` to `EventType`, update unique constraint
- **Backend API**: Update event type CRUD to handle per-type availability rules and booking calendar; new availability preview endpoint
- **Sync engine**: No changes (booking availability is computed at request time)
- **Frontend**: Event type edit modal gains working hours editor and booking calendar selector; new availability preview page/component
