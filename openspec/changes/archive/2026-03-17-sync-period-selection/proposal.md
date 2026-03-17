## Why

The target calendar sync currently has no user control over how far into the future events are cloned. The forward sync window is hardcoded (365 days for Outlook, unlimited for Google). Users need to control this to avoid cluttering their target calendar with far-future events they don't need yet.

## What Changes

- Add a `syncDaysInAdvance` setting to the target calendar configuration (options: 30, 60, 90 days)
- Store this setting in the database alongside the target calendar selection
- Apply this window when cloning events to the target calendar — only events within the chosen period are synced
- Add a dropdown in the settings UI next to the target calendar selector

## Capabilities

### New Capabilities
- `sync-period`: User-configurable forward sync window (30/60/90 days) for target calendar event cloning

### Modified Capabilities
_(none — this is additive to the existing target calendar feature, no existing spec requirements change)_

## Impact

- **Database**: New column `syncDaysInAdvance` on `CalendarEntry` (default 30)
- **Backend API**: `PUT /api/target-calendar` accepts optional `syncDaysInAdvance` param; `GET` returns it
- **Sync engine**: `cloneToTarget` in `sync-job.ts` filters events by the configured window
- **Frontend**: Settings page gets a period selector in the Target Calendar card
