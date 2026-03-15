## 1. Auth & Middleware

- [x] 1.1 Add `role` to the JWT callback in `packages/web/src/lib/auth.ts` — read `user.role` from DB during `jwt` callback and include it in the token
- [x] 1.2 Update `AuthUser` interface in `packages/backend/src/lib/auth.ts` to include `role` field, extract it from JWT payload in `authenticate()`
- [x] 1.3 Create `requireAdmin` middleware function in `packages/backend/src/lib/auth.ts` that returns 403 if `user.role !== "admin"`
- [x] 1.4 Add admin user seeding in `packages/backend/src/server.ts` — upsert user with email `admin`, bcrypt-hashed password `adminpass123`, role `admin` on startup

## 2. Admin API Routes

- [x] 2.1 Create `packages/backend/src/routes/admin.ts` with `requireAdmin` preHandler hook on all routes
- [x] 2.2 Implement `GET /api/admin/users` — paginated, searchable user list with `_count.calendarSources` and `accounts.provider`; query params: `search`, `page`, `limit`
- [x] 2.3 Implement `GET /api/admin/sync` — return BullMQ job counts (`getJobCounts`) and 50 most recent jobs (`getJobs`) with id, state, data, timestamps, failedReason, attemptsMade
- [x] 2.4 Register `adminRoutes` in `packages/backend/src/server.ts`

## 3. Frontend Admin Pages

- [x] 3.1 Create `packages/web/src/app/admin/page.tsx` — users table with search input, columns: Email, Name, Providers, Calendars, Joined
- [x] 3.2 Create `packages/web/src/app/admin/sync/page.tsx` — summary cards for job counts (active, waiting, completed, failed) and recent jobs table with columns: Source ID, State, Started, Finished, Error, Attempts
- [x] 3.3 Add admin role check on both pages — redirect to `/` if session user role is not `admin`
- [x] 3.4 Add navigation link to admin in AppShell (visible only to admin users)

## 4. Verification

- [x] 4.1 Verify backend compiles with `npx tsc --noEmit`
- [x] 4.2 Verify frontend compiles with `npx tsc --noEmit`
- [ ] 4.3 Test end-to-end: login as admin → see users list → navigate to sync queue → verify data displays
