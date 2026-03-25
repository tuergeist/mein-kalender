## 1. Database

- [x] 1.1 Add `syncMode` field (String, default "full") to `CalendarEntry` model in schema.prisma
- [x] 1.2 Create and apply migration

## 2. Sync Engine

- [x] 2.1 Change `cloneToTarget()` to find ALL target calendars (`findMany` instead of `findFirst`) and loop over each
- [x] 2.2 Add `[Sync]` prefix filter: exclude events with title starting with `[Sync]` from unmapped events query
- [x] 2.3 Implement blocked sync mode: when `syncMode === "blocked"`, use title `[Sync] Busy` with null description/location in create and update
- [x] 2.4 Ensure each target's filter settings (skipDeclined, skipFree, etc.) are applied independently

## 3. Backend API

- [x] 3.1 Add `GET /api/sync-targets` — list all target calendar entries for the user with source calendars, filters, and sync mode
- [x] 3.2 Add `POST /api/sync-targets` — mark a calendar entry as target, set source calendars, sync mode, and filters
- [x] 3.3 Add `PUT /api/sync-targets/:id` — update target's source calendars, sync mode, and filters
- [x] 3.4 Add `DELETE /api/sync-targets/:id` — unmark as target, clean up mappings and optionally synced events
- [x] 3.5 Keep existing `GET/PUT /api/target-calendar` working for backward compatibility (reads/writes first target)

## 4. Frontend — Sync Page

- [x] 4.1 Replace single target calendar selector with a list of sync targets (cards showing target name, source count, sync mode)
- [x] 4.2 Add "New Sync Target" flow: pick target calendar → select source calendars → choose sync mode (full/blocked) → set filters
- [x] 4.3 Add edit flow for existing targets: change sources, mode, filters
- [x] 4.4 Add delete target with confirmation modal
- [x] 4.5 Show sync mode badge on each target card ("Full" or "Blocked")

## 5. Verification

- [x] 5.1 Verify existing single-target setup still works (backward compat)
- [x] 5.2 Verify loop prevention: `[Sync]` events on source calendar are not re-synced
- [x] 5.3 Verify blocked mode creates events with "Busy" title and no details
- [x] 5.4 Verify two targets with different filters produce different results
