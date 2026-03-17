## 1. Database

- [x] 1.1 Add `syncDaysInAdvance Int @default(30)` column to `CalendarEntry` model in `schema.prisma`
- [x] 1.2 Create and run Prisma migration

## 2. Backend API

- [x] 2.1 Update `PUT /api/target-calendar` to accept optional `syncDaysInAdvance` param (validate: must be 30, 60, or 90; default 30)
- [x] 2.2 Update `GET /api/target-calendar` response to include `syncDaysInAdvance`
- [x] 2.3 Store `syncDaysInAdvance` on the CalendarEntry when setting target

## 3. Sync Engine

- [x] 3.1 In `cloneToTarget` (`sync-job.ts`), read `syncDaysInAdvance` from the target CalendarEntry
- [x] 3.2 Add date filter to the unmapped events query: `startTime <= now + syncDaysInAdvance`

## 4. Frontend

- [x] 4.1 Add a sync period dropdown (30/60/90 days) to the Target Calendar card in settings
- [x] 4.2 Send `syncDaysInAdvance` in the `PUT /api/target-calendar` request when setting/updating target
- [x] 4.3 Load and display the current `syncDaysInAdvance` value from `GET /api/target-calendar`
