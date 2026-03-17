## Why

Both target calendar sync and booking availability currently use all enabled source calendars. Users need granular control: sync only work calendars to the target (not birthdays), or check only specific calendars for booking conflicts per event type (e.g., an "Office Hours" booking should only look at the work calendar, not the personal one).

## What Changes

- **Target sync**: Add a configurable list of source calendar entries to include when cloning to the target. Default: all enabled (current behavior). Stored as a many-to-many relation.
- **Booking availability**: Add a configurable list of calendar entries per event type to check for busy/free conflicts. Default: all enabled (current behavior). Stored as a many-to-many relation.
- **Settings UI**: Multi-select calendar picker in target calendar settings card
- **Booking settings UI**: Multi-select calendar picker per event type (in edit modal)
- **Read stays the same**: All enabled calendars continue to be synced/fetched from providers. This only controls which are *used* for writing (target sync) and conflict detection (booking).

## Capabilities

### New Capabilities
- `calendar-selection`: Per-context calendar selection for target sync and booking availability

### Modified Capabilities
_(none)_

## Impact

- **Database**: Two new join tables: `_TargetSyncCalendars` (CalendarEntry ↔ CalendarEntry) and `_EventTypeCalendars` (EventType ↔ CalendarEntry)
- **Sync engine**: `cloneToTarget` query adds calendar entry filter
- **Public booking**: `computeSlots` query adds calendar entry filter
- **Backend API**: `PUT /api/target-calendar` accepts `sourceCalendarEntryIds`; `PUT /api/event-types/:id` accepts `calendarEntryIds`
- **Frontend**: Multi-select pickers in target calendar settings and event type edit modal
