## Context

Currently:
- `cloneToTarget` in `sync-job.ts` queries events where `calendarEntry.source.userId = X, isTarget = false, enabled = true`
- `computeSlots` in `public-booking.ts` queries events where `calendarEntry.source.userId = X, enabled = true`
- Both use ALL enabled calendars — no per-context filtering

Users want to control which calendars feed into each context independently.

## Goals / Non-Goals

**Goals:**
- Per-target-calendar selection of which source calendars to sync from
- Per-event-type selection of which calendars to check for booking conflicts
- Default: all enabled calendars (backward compatible, no breaking change)
- Design should not block future multiple-target support

**Non-Goals:**
- Multiple target calendars (later)
- Per-source-calendar filtering at fetch time (we always sync everything)

## Decisions

### 1. Many-to-many via Prisma implicit relations

**Target sync**: `CalendarEntry` (the target) has a `sourceCalendars CalendarEntry[]` relation. When empty → use all enabled (default).

**Booking availability**: `EventType` has a `calendars CalendarEntry[]` relation. When empty → use all enabled (default).

Prisma implicit many-to-many creates a join table automatically (`_TargetSyncCalendars`, `_EventTypeCalendars`).

**Why implicit over explicit join table:** No extra data on the relation, just IDs. Prisma implicit is simpler and the `connect`/`set` API is clean.

### 2. Empty array = all enabled (default behavior)

Rather than requiring users to select calendars upfront, an empty selection means "all enabled" — same as today. This makes the feature opt-in and backward compatible. The query logic:

```
if selectedIds is empty:
  filter by enabled: true (current behavior)
else:
  filter by id IN selectedIds
```

### 3. API shape

`PUT /api/target-calendar` gains `sourceCalendarEntryIds: string[]` (optional). Omitted = no change. Empty array `[]` = reset to "all".

`PUT /api/event-types/:id` gains `calendarEntryIds: string[]` (optional). Same semantics.

`GET` responses include the current selection arrays.

### 4. UI: multi-select with checkboxes

Both settings use a checkbox list of all the user's calendar entries (from all sources). Unchecking all = "use all" (default).

## Risks / Trade-offs

- **Empty = all** is slightly counterintuitive but avoids a migration to populate every existing target/event-type with all calendar IDs. A "Use all calendars" label makes this clear in the UI.
