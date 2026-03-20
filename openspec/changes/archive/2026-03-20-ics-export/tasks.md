## 1. Database

- [x] 1.1 Create `IcsFeed` model (id, userId, name, token unique, mode, daysInAdvance, createdAt)
- [x] 1.2 Add many-to-many relation `IcsFeed <-> CalendarEntry`
- [x] 1.3 Create migration, regenerate Prisma client

## 2. Backend — Feed CRUD

- [x] 2.1 Create `routes/ics-feeds.ts` with auth: GET `/api/ics-feeds`, POST (create), PUT `:id` (update), DELETE `:id`
- [x] 2.2 Auto-generate crypto-random token (32 chars) on create
- [x] 2.3 Register routes in server.ts

## 3. Backend — ICS serving

- [x] 3.1 Create `GET /api/ics-feed/:token.ics` endpoint (NO auth middleware)
- [x] 3.2 Look up feed by token, load events from selected calendars within date range
- [x] 3.3 Generate valid VCALENDAR output (VEVENT per event, handle full vs freebusy mode)
- [x] 3.4 Set `Content-Type: text/calendar` and `Content-Disposition` headers
- [x] 3.5 Register route in server.ts (without auth)

## 4. Frontend — Feed management

- [x] 4.1 Add ICS Feeds section to the sync page (list feeds with URL + copy button)
- [x] 4.2 Create feed modal: name, mode (full/freebusy), days in advance, calendar selection (grouped by source)
- [x] 4.3 Edit/delete feeds

## 5. Frontend — Calendar view integration

- [x] 5.1 Add "Export ICS" button to calendar view toolbar
- [x] 5.2 On click: open feed creation modal pre-filled with currently visible calendars
