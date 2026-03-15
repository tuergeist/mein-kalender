## Why

There is no way to see what's happening in the system — who's signed up, which calendars are connected, or whether sync jobs are failing. An admin UI provides visibility into users, their calendar sources, and the sync queue.

## What Changes

- Add `/admin` pages (protected by role check) with three views:
  - **Users list**: searchable table showing each user, their login provider(s) (Google, Outlook, credentials), and connected calendar count
  - **Sync queue/status**: live view of BullMQ jobs — active, waiting, completed, and failed — with error details
- Add admin API routes (`/api/admin/*`) with role-based middleware that checks `user.role === "admin"`
- Seed an admin user on startup: email `admin`, password `adminpass123`, role `admin`
- Include the `role` field in the JWT so the backend middleware can check it without a DB lookup

## Capabilities

### New Capabilities
- `admin-users-view`: Searchable user list with connected calendar count and login providers
- `admin-sync-view`: Sync queue dashboard showing active/waiting/failed jobs and error details
- `admin-auth`: Role-based access control for admin routes and admin user seeding

### Modified Capabilities
_(none)_

## Impact

- **Backend**: New route module `routes/admin.ts`, auth middleware update to include role, seed script or startup hook for admin user
- **Frontend**: New pages under `packages/web/src/app/admin/`, admin layout with nav
- **Database**: No schema changes (role field already exists on User)
- **Auth**: JWT callback needs to include `role` claim; backend `AuthUser` interface needs `role` field
