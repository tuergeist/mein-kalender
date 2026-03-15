## Context

The app has Users with a `role` field (default `"user"`) that is currently unused. Auth uses JWT via NextAuth (frontend) verified by `fast-jwt` (backend). The backend is Fastify with route modules registered on a shared instance. Sync runs via BullMQ with Redis, with a worker processing jobs at concurrency 5.

There is no admin visibility — no way to list users, see connected calendars across the system, or inspect the sync queue.

## Goals / Non-Goals

**Goals:**
- Admin pages at `/admin` showing users and sync queue
- Role-based API protection (`role === "admin"`)
- Seeded admin user on app startup
- Searchable, paginated data

**Non-Goals:**
- User management actions (delete, disable, impersonate)
- Editing sync jobs or calendar sources from admin
- Real-time WebSocket updates (polling is fine for now)
- Audit logging

## Decisions

### 1. Admin auth: role in JWT vs. DB lookup per request
**Decision**: Add `role` to the JWT claims. Backend middleware reads it from the token.
**Rationale**: The role field rarely changes. Avoiding a DB lookup per admin request keeps the pattern consistent with existing auth. If a user's role is changed, they need to re-login for it to take effect — acceptable for an admin-only feature.
**Alternative**: DB lookup per request — more accurate but adds latency and a Prisma call to every admin endpoint.

### 2. Admin API routes: separate module vs. inline in existing routes
**Decision**: New `routes/admin.ts` module with its own `requireAdmin` preHandler hook.
**Rationale**: Keeps admin logic isolated. The hook checks `user.role === "admin"` and returns 403 otherwise. All admin endpoints live in one file.

### 3. Admin user seeding: startup hook vs. seed script
**Decision**: Seed on backend startup in `server.ts` — upsert a user with email `admin`, password `adminpass123`, role `admin`. Use `upsert` so it's idempotent.
**Rationale**: No manual step needed. The admin user exists as soon as the app starts. Password is hardcoded for simplicity — this is a private/self-hosted app.

### 4. Sync queue data: BullMQ API vs. custom DB tracking
**Decision**: Query BullMQ directly using its `Queue` API (`getJobs`, `getJobCounts`). No additional DB tables.
**Rationale**: BullMQ already tracks job state (active, waiting, completed, failed), timestamps, error messages, and attempt counts. Duplicating this in Postgres would be redundant. The Queue API provides everything needed.

### 5. Frontend routing: Next.js pages under `/admin`
**Decision**: Pages at `packages/web/src/app/admin/page.tsx` (users) and `packages/web/src/app/admin/sync/page.tsx` (sync queue). No shared admin layout — each page uses `AppShell` directly.
**Rationale**: Matches existing page structure. Two pages is simple enough not to need a nested layout.

### 6. Users API: single endpoint with search + pagination
**Decision**: `GET /api/admin/users?search=&page=1&limit=20` returns users with aggregated `_count` of calendarSources and their Account providers.
**Rationale**: Prisma's `include: { _count: { select: { calendarSources: true } }, accounts: { select: { provider: true } } }` gives us everything in one query. Search filters on email or displayName with `contains` (case-insensitive).

### 7. Sync queue API: single endpoint returning job counts + recent jobs
**Decision**: `GET /api/admin/sync` returns `{ counts: { active, waiting, completed, failed }, jobs: [...] }`. Jobs include the most recent 50 across all states, sorted by timestamp descending.
**Rationale**: One call gives the admin a complete picture. BullMQ's `getJobs()` accepts state filters and pagination.

## Risks / Trade-offs

- **[Hardcoded admin credentials]** → Acceptable for self-hosted use. Could be moved to env vars later if needed.
- **[JWT role caching]** → Role changes require re-login. Acceptable since role changes are rare and admin-only.
- **[BullMQ API performance]** → `getJobs()` can be slow with thousands of completed jobs. Mitigated by limiting to 50 most recent and using state filters.
- **[No real-time updates]** → Admin must refresh to see new data. Acceptable for an admin dashboard; can add polling or WebSocket later.
