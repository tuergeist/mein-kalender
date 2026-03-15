## Why

The target calendar sync currently clones all events regardless of the user's response status or busy/free indicator. This means declined events and free/tentative events clutter the target calendar. Users need these filtered out to keep the target calendar useful as an availability view.

## What Changes

- Store event response status (`accepted`, `declined`, `tentative`, `needsAction`) in provider metadata for both Google and Outlook
- Store busy/free status (`showAs`/`transparency`) in Outlook provider metadata (Google already stores `transparency`)
- Add two target sync filters: `skipDeclined` (default true), `skipFree` (default false)
- Filter events in `cloneToTarget` based on these settings
- Add toggle switches in the Target Calendar settings UI
- Per-calendar filtering already works via the existing `enabled` toggle in the sidebar — no new work needed

## Capabilities

### New Capabilities
- `sync-event-filters`: Filtering of declined and free/tentative events from target calendar sync

### Modified Capabilities
_(none)_

## Impact

- **Providers**: Google `mapEvent` needs to capture `responseStatus` from `attendees` self entry; Outlook `mapEvent` needs to capture `responseStatus` and `showAs`
- **Database**: Two new boolean columns on `CalendarEntry`
- **Backend API**: `PUT /api/target-calendar` accepts the two new filter booleans
- **Sync engine**: `cloneToTarget` filters by response status and transparency/showAs
- **Frontend**: Two new toggles in the Target Calendar settings card
