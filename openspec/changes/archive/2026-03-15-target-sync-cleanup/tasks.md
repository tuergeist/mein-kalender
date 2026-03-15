## 1. Schema

- [x] 1.1 Add `lastSyncedAt DateTime?` field to `TargetEventMapping` model in `schema.prisma`
- [x] 1.2 Apply migration with `npx prisma db push`

## 2. Deletion propagation

- [x] 2.1 In `syncCalendarEntry()` deletion block: before deleting local events, look up their TargetEventMappings and call `deleteEvent()` on the target provider for each
- [x] 2.2 Handle `deleteEvent()` failures gracefully (log and continue)
- [x] 2.3 Pass target provider context into `syncCalendarEntry()` or resolve it inside the deletion block

## 3. Orphan cleanup

- [x] 3.1 At the start of `cloneToTarget()`, query for TargetEventMappings where the source event no longer exists
- [x] 3.2 Call `deleteEvent()` on the target provider for each orphan, then delete the mapping
- [x] 3.3 Handle provider failures gracefully (delete mapping anyway)

## 4. Change-aware updates

- [x] 4.1 In the update loop, compare `sourceEvent.updatedAt` with `mapping.lastSyncedAt` — skip if unchanged
- [x] 4.2 After successful `updateEvent()`, update `lastSyncedAt` on the mapping
- [x] 4.3 Treat `lastSyncedAt = null` as needing update

## 5. Duplicate prevention

- [x] 5.1 Wrap `targetEventMapping.create()` in try-catch to handle unique constraint violations
- [x] 5.2 Log and skip on duplicate instead of crashing

## 6. Verification

- [x] 6.1 Verify TypeScript compiles with `npx tsc --noEmit`
- [x] 6.2 Test: delete a source event, verify cloned event is removed from target
- [x] 6.3 Test: sync with no changes, verify no unnecessary `updateEvent()` calls in logs
