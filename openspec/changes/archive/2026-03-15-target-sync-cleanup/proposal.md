## Why

When source events are deleted, their cloned copies on the target calendar are never removed — they become orphans. Additionally, the update loop blindly pushes every mapped event to the target provider on every sync cycle, even if nothing changed, wasting API quota and risking rate limits. These gaps make the target calendar unreliable and noisy.

## What Changes

- Delete cloned events from the target calendar when their source events are deleted
- Clean up orphaned mappings where the source event no longer exists (e.g., calendar was disconnected)
- Only update target events when the source event has actually changed since the last sync
- Handle duplicate mappings gracefully (prevent creating two clones of the same event)

## Capabilities

### New Capabilities
- `target-sync-lifecycle`: Full lifecycle management for cloned target events — deletion propagation, orphan cleanup, and change-aware updates

### Modified Capabilities
_(none)_

## Impact

- **Backend**: `packages/backend/src/sync-job.ts` — `cloneToTarget()` function and `syncCalendarEntry()` deletion handling
- **Database**: `packages/backend/prisma/schema.prisma` — may need `updatedAt` tracking on TargetEventMapping
- **API quota**: Reduces unnecessary provider API calls by skipping unchanged events
