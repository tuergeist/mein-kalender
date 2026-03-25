## Context

The sync engine currently assumes one target calendar per user (`findFirst({ isTarget: true })`). The database already supports multiple targets — `CalendarEntry.isTarget` is a boolean, and `TargetEventMapping` links to a specific `targetCalendarEntryId`. The self-referencing `sourceCalendars`/`syncTargets` relation on `CalendarEntry` already lets each target specify which source calendars to pull from. The main blocker is `cloneToTarget()` which only processes one target, and the API/UI which only exposes a single target.

## Goals / Non-Goals

**Goals:**
- Multiple target calendars per user, each with independent source selection and filters
- Loop prevention: events with `[Sync]` prefix are never synced back out
- Sync mode per target: "full" (all details) or "blocked" (title = "Busy", no description/location)
- Backward-compatible: existing single-target setups continue working

**Non-Goals:**
- Real-time bidirectional sync (still poll-based)
- Conflict resolution between competing edits on the same event
- Per-event sync direction control (always all-or-nothing per target)
- Syncing back changes made to `[Sync]` events on the target

## Decisions

### Reuse existing schema with one new field
The `CalendarEntry` model already supports multiple `isTarget=true` entries and has `sourceCalendars` relation + filter fields. Add only `syncMode` (String, default "full") to `CalendarEntry`. No new tables needed.

**Alternative considered:** Dedicated `SyncRule` table with source/target/mode/filters — rejected because `CalendarEntry` already carries all the filter fields and the `sourceCalendars` relation. Adding another table would duplicate filter configuration.

### Loop prevention via title prefix
Skip events whose title starts with `[Sync]` when building the unmapped events list in `cloneToTarget()`. This is a simple, debuggable, and already-in-use convention.

**Alternative considered:** Track source origin via a `syncOriginId` field on Event — more robust but requires schema changes and complicates the sync delta processing. Title prefix is sufficient because the app controls event creation and always uses the prefix.

### `cloneToTarget()` iterates over all targets
Change `findFirst` to `findMany` for `isTarget: true`. Loop over each target entry, running the full orphan-cleanup → create → update cycle independently. Each iteration uses its own provider/token (targets can be on different calendar sources).

### Blocked mode implementation
When `syncMode === "blocked"`, `cloneToTarget()` replaces the event title with "Busy" and sets description and location to null before calling `createEvent`/`updateEvent`. The source event data is unchanged — only the cloned copy is redacted.

### API changes: multi-target CRUD
Replace the single `GET/PUT /api/target-calendar` with list + create + update + delete endpoints. The existing endpoint returns the first target for backward compatibility during transition, then gets deprecated.

## Risks / Trade-offs

- **[Multiple targets on same calendar provider could hit rate limits]** → Already chunking updates (CHUNK_SIZE=5). Each target runs sequentially, not in parallel, so API calls are spread out.
- **[Title-based loop detection is fragile]** → If a user manually renames a `[Sync]` event, it could be re-synced. Acceptable risk — users shouldn't edit synced events.
- **[Existing single-target users]** → Their setup continues working unchanged. The UI shows their existing target as the first entry in a list.
