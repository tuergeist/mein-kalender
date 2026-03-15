## Context

`cloneToTarget()` currently handles two operations: create unmapped events on the target, and update all mapped events. It has no deletion logic and no change detection.

Source event deletions happen in `syncCalendarEntry()` (lines 159-175), which deletes the local event and its `TargetEventMapping` records — but never calls `deleteEvent()` on the target provider. The cloned event stays on the target calendar forever.

The update loop fetches all mappings and pushes every one to the target provider, regardless of whether the source event changed. With 100+ mapped events, this means 100+ unnecessary API calls per sync.

## Goals / Non-Goals

**Goals:**
- Propagate source event deletions to the target calendar
- Clean up orphaned mappings (source event or source calendar no longer exists)
- Only update target events when the source event has changed
- Prevent duplicate target mappings for the same source event

**Non-Goals:**
- Bi-directional sync (changes on target calendar do not propagate back)
- Partial event sync / event filtering (separate change)
- Conflict resolution for concurrent edits (target is always overwritten from source)

## Decisions

### 1. Delete target events during source deletion
**Decision**: In `syncCalendarEntry()`, before deleting the local event, look up its target mappings, call `deleteEvent()` on the target provider for each, then delete the mapping and local event.
**Rationale**: This is the natural place — we already know which events are being deleted and have the provider context. Doing it here keeps deletion synchronous with the sync cycle rather than requiring a separate cleanup pass.

### 2. Orphan cleanup in cloneToTarget
**Decision**: At the start of `cloneToTarget()`, find all mappings where the source event no longer exists (LEFT JOIN with NULL) and delete those target events + mappings.
**Rationale**: Handles edge cases where events were deleted outside the normal sync flow (e.g., source was disconnected, DB was manually cleaned up). This is a safety net, not the primary deletion path.

### 3. Change detection via updatedAt comparison
**Decision**: Add `lastSyncedAt` to `TargetEventMapping`. During the update phase, only push to the target provider if `sourceEvent.updatedAt > mapping.lastSyncedAt`. After a successful update, set `lastSyncedAt = now()`.
**Rationale**: Simple timestamp comparison avoids field-by-field diffing. Prisma auto-updates `Event.updatedAt` on any change, so this is reliable.

### 4. Unique constraint as duplicate guard
**Decision**: The existing `@@unique([sourceEventId, targetCalendarEntryId])` on `TargetEventMapping` already prevents duplicate mappings. Add a try-catch around mapping creation to handle the race condition gracefully (log and skip if duplicate).
**Rationale**: No schema change needed — just handle the constraint violation instead of crashing.

## Risks / Trade-offs

- **[Target provider deleteEvent fails]** → If the target provider rejects the deletion (event already removed, permission denied), log the error and delete the mapping anyway. The mapping is useless without the source event.
- **[Clock skew in lastSyncedAt]** → If the server clock drifts, an update might be missed. Acceptable risk — the next full sync after restart would catch it. Could add a periodic "force refresh" if needed later.
- **[Orphan cleanup cost]** → The orphan query runs on every sync. With indexes on `TargetEventMapping(sourceEventId)`, this is a fast LEFT JOIN. Already indexed.
