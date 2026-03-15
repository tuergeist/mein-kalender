## Context

The target calendar sync (`cloneToTarget` in `sync-job.ts`) already filters by `syncDaysInAdvance`, `skipWorkLocation`, and `skipSingleDayAllDay`. Events are stored with `providerMetadata` JSON that can hold arbitrary provider-specific data.

Currently:
- **Google** stores `eventType`, `workingLocation`, `transparency` in metadata — but NOT `responseStatus`
- **Outlook** stores NO metadata at all

Both Google Calendar API and Microsoft Graph API return response status and busy/free info that we need to capture.

## Goals / Non-Goals

**Goals:**
- Capture response status and show-as/transparency from both providers
- Skip declined events by default
- Optionally skip free/tentative events
- Expose both as toggles in settings

**Non-Goals:**
- Per-calendar filtering — already works via `enabled` toggle
- Filtering by other criteria (e.g., specific titles, categories)

## Decisions

### 1. Normalize response status into metadata

Google returns `attendees[].self === true → responseStatus` with values: `needsAction`, `declined`, `tentative`, `accepted`.

Outlook returns `responseStatus.response` with values: `none`, `organizer`, `tentativelyAccepted`, `accepted`, `declined`, `notResponded`.

We normalize both to a common `responseStatus` field in `providerMetadata`:
- `accepted` — Google: `accepted`, Outlook: `accepted`/`organizer`
- `declined` — both: `declined`
- `tentative` — Google: `tentative`, Outlook: `tentativelyAccepted`
- `needsAction` — Google: `needsAction`, Outlook: `none`/`notResponded`

### 2. Normalize show-as/transparency

Google uses `transparency`: `"transparent"` (free) or `"opaque"` (busy, default).

Outlook uses `showAs`: `"free"`, `"tentative"`, `"busy"`, `"oof"`, `"workingElsewhere"`, `"unknown"`.

We normalize to a `showAs` field:
- `free` — Google: `transparent`, Outlook: `free`
- `tentative` — Outlook only: `tentative`
- `busy` — Google: `opaque`/absent, Outlook: `busy`/`oof`/`workingElsewhere`

### 3. Filter logic in cloneToTarget

When `skipDeclined` is true: skip events where `responseStatus === "declined"`.

When `skipFree` is true: skip events where `showAs === "free"` or `showAs === "tentative"` or `transparency === "transparent"`.

Both filters read from `providerMetadata` at clone time, same pattern as the existing `skipWorkLocation` filter.

### 4. Two new columns on CalendarEntry

- `skipDeclined Boolean @default(true)` — on by default since declined events are rarely useful
- `skipFree Boolean @default(false)` — off by default since some users want free-time blocks synced

## Risks / Trade-offs

- **Existing events won't have metadata**: Events already synced before this change won't have `responseStatus`/`showAs` in their metadata. They'll pass through the filter (not skipped) since the metadata is absent. This is acceptable — on the next full sync or event update, the metadata will be populated.
- **Google attendees array can be large**: We only need the self entry. We search for `self: true` in the attendees array, which is efficient.
