## 1. Provider Metadata

- [x] 1.1 Google provider: capture `responseStatus` from self attendee in `mapEvent` (normalize to `accepted`/`declined`/`tentative`/`needsAction`; default `accepted` if no attendees)
- [x] 1.2 Google provider: normalize existing `transparency` into `showAs` (`transparent` → `free`, `opaque`/absent → `busy`)
- [x] 1.3 Outlook provider: capture `responseStatus.response` in `mapEvent` (normalize `organizer` → `accepted`, `tentativelyAccepted` → `tentative`, `none`/`notResponded` → `needsAction`)
- [x] 1.4 Outlook provider: capture `showAs` in `mapEvent` (normalize `free` → `free`, `tentative` → `tentative`, `busy`/`oof`/`workingElsewhere` → `busy`)

## 2. Database

- [x] 2.1 Add `skipDeclined Boolean @default(true)` and `skipFree Boolean @default(false)` to `CalendarEntry` in `schema.prisma`
- [x] 2.2 Regenerate Prisma client

## 3. Backend API

- [x] 3.1 Update `PUT /api/target-calendar` to accept optional `skipDeclined` and `skipFree` booleans and store them
- [x] 3.2 `GET /api/target-calendar` already returns all CalendarEntry fields — verify it includes the new columns

## 4. Sync Engine

- [x] 4.1 Add `skipDeclined` filter in `cloneToTarget`: skip events where `providerMetadata.responseStatus === "declined"`
- [x] 4.2 Add `skipFree` filter in `cloneToTarget`: skip events where `showAs` is `"free"` or `"tentative"`, or legacy `transparency === "transparent"`

## 5. Frontend

- [x] 5.1 Add `skipDeclined` and `skipFree` state variables, load from `GET /api/target-calendar`
- [x] 5.2 Add two Switch toggles in the Target Calendar settings card
- [x] 5.3 Send the new booleans via `handleSetTarget` when toggled
