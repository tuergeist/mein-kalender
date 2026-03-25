## Why

Today the app supports one-way sync: events from source calendars B and C are cloned to a single target calendar A. But users need events to flow in both directions. A company calendar (A) needs private events from calendar B visible as blocked time so colleagues see correct availability. A shared family calendar (B) needs work events from A so a partner can see real availability. Without this, users must manually block time in multiple calendars — defeating the purpose of the sync tool.

## What Changes

- **Multiple sync targets**: A user can configure more than one target calendar. Each target has its own set of source calendars, filters, and sync settings.
- **Loop prevention**: Events already synced INTO a calendar (prefixed `[Sync]`) are never synced back out. This prevents A→B→A infinite loops.
- **Sync mode per target**: Each target can sync as "full details" (title, description, location) or "blocked only" (title replaced with "Busy", no description/location). This lets users share availability without exposing meeting details.
- **Independent filter sets**: Each sync target has its own filter configuration (skip declined, skip free, skip work location, skip all-day, source calendar selection).

### Example setup
- **Target A** (work): sources B, C → full details → filters: skip declined
- **Target B** (family): source A → blocked only → filters: skip free, skip `[Sync]` events

## Capabilities

### New Capabilities
- `multi-target-sync`: Support for multiple target calendars with independent source selection, filters, and sync mode (full/blocked). Includes loop prevention by skipping `[Sync]`-prefixed events.

### Modified Capabilities
- `target-sync-lifecycle`: The sync engine currently assumes a single target calendar per user. Must support iterating over multiple targets, each with its own source calendars and filter settings.

## Impact

- **Database**: The current single-target model (one `CalendarEntry` with `isTarget=true` per user) must support multiple targets. The `TargetEventMapping` already links to a specific `targetCalendarEntryId`, so it supports multi-target by design.
- **Sync engine**: `cloneToTarget()` in `sync-job.ts` currently finds THE target calendar. Must loop over all targets. Each target runs its own filter/create/update/delete cycle.
- **Loop prevention**: `cloneToTarget()` must skip events whose title starts with `[Sync]` when building the unmapped events list. This is the simplest loop-breaking mechanism — events that arrived via sync are never re-synced out.
- **API**: Target calendar endpoints (`/api/target-calendar`) change from single-target to multi-target CRUD. New `syncMode` field ("full" | "blocked").
- **Frontend**: Sync page UI changes from "set target calendar" to a list of sync rules, each with target, sources, mode, and filters.
- **No breaking changes to existing single-target setups** — the existing target becomes the first entry in the multi-target list.
