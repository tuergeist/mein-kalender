## Context

The target calendar feature clones events from all source calendars into a single target calendar. Currently the forward sync window is hardcoded per provider (365 days for Outlook, no explicit limit for Google). Users have no control over how far ahead events are synced.

The `CalendarEntry` model tracks which calendar is the target (`isTarget: true`). The `cloneToTarget` function in `sync-job.ts` queries all unmapped events and clones them, with no date filtering.

## Goals / Non-Goals

**Goals:**
- Let users choose how far in advance to sync: 30, 60, or 90 days
- Store this preference per-user (on the target calendar entry)
- Filter event cloning by the configured window
- Expose the setting in the existing Target Calendar settings card

**Non-Goals:**
- Changing the source calendar fetch window (the 30-day lookback / provider date ranges stay as-is)
- Making the period fully custom (free-form input) — fixed options only for simplicity
- Retroactive cleanup of events outside the new window (handled by existing orphan cleanup)

## Decisions

### 1. Store `syncDaysInAdvance` on CalendarEntry

Add an `Int` column `syncDaysInAdvance` with default `30` to the `CalendarEntry` model. Only meaningful when `isTarget = true`.

**Why on CalendarEntry vs. User:** Keeps it co-located with the target flag. If we ever support multiple targets (different accounts), this scales. Adding it to User would require a join or separate query.

**Alternative considered:** A separate `TargetConfig` table — rejected as over-engineering for a single field.

### 2. Fixed options (30/60/90) not free-form

A dropdown with 3 options is simpler to validate and less error-prone than a number input. Covers realistic use cases.

### 3. Filter at clone time, not fetch time

The `cloneToTarget` function will add a `WHERE startTime < NOW() + syncDaysInAdvance` filter when querying unmapped events. This is simpler than changing provider fetch logic and keeps source data complete for the calendar view.

## Risks / Trade-offs

- **Events outside window still in DB**: Source events beyond 90 days exist locally (for the calendar view) but won't be cloned to target. This is intentional — no data loss risk.
- **Changing the period doesn't retroactively delete**: If a user goes from 90→30 days, already-cloned events beyond 30 days stay on the target. The existing orphan cleanup in `cloneToTarget` will handle this naturally on the next sync cycle since those events will fall outside the window and won't be re-created if deleted.
