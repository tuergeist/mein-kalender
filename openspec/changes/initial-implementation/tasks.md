## 1. Project Setup & Monorepo

- [x] 1.1 Initialize Turborepo monorepo with `web`, `api`, `sync-worker`, and `shared` packages
- [x] 1.2 Configure TypeScript, ESLint, and Prettier across all packages
- [x] 1.3 Set up `shared` package with common types (Event, Calendar, CalendarSource, User, Provider enums)
- [x] 1.4 Create `.env.example` documenting all required environment variables
- [x] 1.5 Create `docker-compose.yml` with PostgreSQL and Redis for local development

## 2. Database & ORM

- [x] 2.1 Set up Prisma in the `api` package with PostgreSQL connection
- [x] 2.2 Create Prisma schema: User model (email, passwordHash, displayName, avatarUrl, createdAt, role placeholder)
- [x] 2.3 Create Prisma schema: CalendarSource model (userId, provider, credentials (encrypted), syncInterval, syncToken, syncStatus, lastSyncAt)
- [x] 2.4 Create Prisma schema: CalendarEntry model (sourceId, name, color, providerCalendarId, isTarget)
- [x] 2.5 Create Prisma schema: Event model (calendarEntryId, sourceEventId, title, description, location, startTime, endTime, allDay, providerMetadata JSONB)
- [x] 2.6 Create Prisma schema: TargetEventMapping model (sourceEventId, targetEventId, targetCalendarEntryId) for target calendar clone tracking
- [x] 2.7 Add Prisma middleware for userId-scoped queries (tenant isolation)
- [x] 2.8 Generate initial migration and verify schema

## 3. Authentication & User Management

- [x] 3.1 Set up NextAuth.js in the `web` package with JWT session strategy
- [x] 3.2 Implement email/password credentials provider with bcrypt (cost 12)
- [x] 3.3 Implement Google OAuth provider for social login
- [x] 3.4 Implement Microsoft OAuth provider for social login
- [x] 3.5 Build sign-up page with HeroUI (email/password form + social login buttons)
- [x] 3.6 Build login page with HeroUI (email/password form + social login buttons)
- [x] 3.7 Implement email verification flow (send verification link, verify endpoint)
- [x] 3.8 Build user profile page (view/edit display name, email, avatar)
- [x] 3.9 Add session-based route protection (redirect unauthenticated users to login)

## 4. Fastify API Server

- [x] 4.1 Set up Fastify server in `api` package with TypeScript
- [x] 4.2 Add JWT validation plugin (verify NextAuth.js tokens)
- [x] 4.3 Implement `/health` endpoint with DB connectivity check
- [x] 4.4 Implement CRUD API routes for calendar sources (`/api/sources`)
- [x] 4.5 Implement API routes for events (`/api/events` — list by date range, update, delete)
- [x] 4.6 Implement API route for manual sync trigger (`POST /api/sources/:id/sync` and `POST /api/sync-all`)
- [x] 4.7 Implement API routes for target calendar configuration (`GET/PUT /api/target-calendar`)
- [x] 4.8 Add env var validation on startup (fail with clear error on missing vars)

## 5. Provider Adapter Interface & Shared Types

- [x] 5.1 Define `CalendarProvider` interface in `shared` (authenticate, listCalendars, getEvents, createEvent, updateEvent, deleteEvent)
- [x] 5.2 Define standardized error types (AuthExpired, RateLimited, NotFound, ProviderUnavailable)
- [x] 5.3 Define normalized Event and Calendar types used across all adapters
- [x] 5.4 Implement AES-256 token encryption/decryption utility with per-tenant key

## 6. Google Calendar Adapter

- [x] 6.1 Implement Google OAuth flow (consent URL generation, token exchange, token storage)
- [x] 6.2 Implement automatic token refresh on expiry
- [x] 6.3 Implement `listCalendars` using Google Calendar API v3
- [x] 6.4 Implement `getEvents` with incremental sync (syncToken support)
- [x] 6.5 Implement `createEvent`, `updateEvent`, `deleteEvent`
- [x] 6.6 Map Google-specific errors to standardized error types

## 7. Microsoft Outlook Adapter

- [x] 7.1 Implement Microsoft OAuth flow (consent URL, token exchange via MSAL, token storage)
- [x] 7.2 Implement automatic token refresh on expiry
- [x] 7.3 Implement `listCalendars` using Microsoft Graph `/me/calendars`
- [x] 7.4 Implement `getEvents` with delta query support (deltaToken)
- [x] 7.5 Implement `createEvent`, `updateEvent`, `deleteEvent` via Graph API
- [x] 7.6 Map Microsoft Graph errors to standardized error types

## 8. Proton Calendar Adapter

- [x] 8.1 Implement Proton bridge connection (CalDAV credentials verification)
- [x] 8.2 Implement `listCalendars` via CalDAV PROPFIND
- [x] 8.3 Implement `getEvents` via CalDAV REPORT (VEVENT parsing to normalized format)
- [x] 8.4 Implement `createEvent`, `updateEvent`, `deleteEvent` via CalDAV (if bridge supports write)
- [x] 8.5 Handle bridge unavailability gracefully (return ProviderUnavailable, skip without blocking other sources)

## 9. Sync Engine

- [x] 9.1 Set up BullMQ in `sync-worker` package with Redis connection
- [x] 9.2 Implement scheduled sync job: poll source → fetch deltas → upsert/delete local events
- [x] 9.3 Implement sync state tracking (store syncToken, lastSyncAt, syncStatus per source)
- [x] 9.4 Implement full sync fallback when syncToken is invalid/expired
- [x] 9.5 Configure retry with exponential backoff (3 retries) and error status marking
- [x] 9.6 Implement concurrency control (one sync job per source at a time)
- [x] 9.7 Implement manual sync trigger (enqueue immediate jobs from API endpoint)
- [x] 9.8 Implement configurable poll interval per source (default 5 min)

## 10. Target Calendar Cloning

- [x] 10.1 Implement target calendar configuration storage (user → target calendar entry)
- [x] 10.2 After local sync, clone new events to target via provider adapter `createEvent`
- [x] 10.3 Store source→target event ID mapping in TargetEventMapping table
- [x] 10.4 Propagate updates from source to target (lookup mapping, call `updateEvent`)
- [x] 10.5 Propagate deletes from source to target (lookup mapping, call `deleteEvent`, remove mapping)
- [x] 10.6 Add source identifier prefix/tag to cloned events on target calendar
- [x] 10.7 Handle target calendar not configured (skip cloning, local-only sync)

## 11. ICS Import

- [x] 11.1 Implement ICS file upload endpoint (parse VEVENT, create read-only calendar source)
- [x] 11.2 Implement ICS file validation (reject non-iCalendar files)
- [x] 11.3 Implement ICS URL subscription endpoint (fetch, parse, create source)
- [x] 11.4 Implement periodic ICS URL refresh via BullMQ scheduled job (reconcile events)
- [x] 11.5 Handle unreachable ICS URL (retain existing events, mark sync error)
- [x] 11.6 Implement re-upload overwrite (replace all events from previous upload)

## 12. Calendar UI — Layout & Navigation

- [x] 12.1 Set up Next.js App Router with HeroUI provider and Tailwind CSS
- [x] 12.2 Build app shell layout: navbar (HeroUI Navbar), sidebar, main content area
- [x] 12.3 Build responsive sidebar with calendar source list, color indicators, and show/hide toggles
- [x] 12.4 Add sync status indicators in sidebar (spinner for syncing, badge for errors)
- [x] 12.5 Build mobile-responsive layout (collapsible sidebar, adapted navigation)

## 13. Calendar UI — Calendar View

- [x] 13.1 Integrate FullCalendar React component with day/week/month views
- [x] 13.2 Connect FullCalendar to API: fetch events for visible date range
- [x] 13.3 Color-code events by source calendar
- [x] 13.4 Implement view mode switching (day/week/month) with HeroUI Tabs or toolbar
- [x] 13.5 Implement date navigation (prev/next, date picker)
- [x] 13.6 Implement mobile-adaptive view (default to day/agenda on small screens)

## 14. Calendar UI — Event Interactions

- [x] 14.1 Build event detail popover/modal (HeroUI Modal) showing full event info
- [x] 14.2 Build event edit form (HeroUI Input, DatePicker, Textarea) with save/cancel
- [x] 14.3 Implement drag-and-drop event rescheduling via FullCalendar interaction plugin
- [x] 14.4 Implement edit propagation: send update to API → source provider → refresh local
- [x] 14.5 Show read-only indicator for ICS-imported events, disable edit controls
- [x] 14.6 Handle edit failures (show error toast, revert to previous state)
- [x] 14.7 Build mobile event detail view (full-screen modal or bottom sheet)

## 15. Calendar UI — Settings & Source Management

- [x] 15.1 Build "Add Calendar" page with provider selection (Google, Outlook, Proton, ICS)
- [x] 15.2 Implement OAuth redirect flow from UI for Google and Outlook
- [x] 15.3 Build Proton bridge credentials form (host, port, username, password)
- [x] 15.4 Build ICS import form (file upload and URL subscription)
- [x] 15.5 Build source settings page (sync interval config, calendar selection per provider)
- [x] 15.6 Build disconnect source flow with confirmation dialog
- [x] 15.7 Build target calendar configuration UI (select writable calendar as clone target)
- [x] 15.8 Add "Sync Now" button in UI with syncing indicator

## 16. Deployment — Docker

- [x] 16.1 Write Dockerfile for `web` (multi-stage, Next.js standalone output, port 3000)
- [x] 16.2 Write Dockerfile for `api` (multi-stage, Fastify, configurable port default 4000)
- [x] 16.3 Write Dockerfile for `sync-worker` (multi-stage, BullMQ worker process)
- [x] 16.4 Add `.dockerignore` files for each package
- [x] 16.5 Verify all three images build and run locally with docker-compose

## 17. Deployment — Kubernetes

- [x] 17.1 Create k8s Deployment + Service for `web`
- [x] 17.2 Create k8s Deployment + Service for `api`
- [x] 17.3 Create k8s Deployment for `sync-worker`
- [x] 17.4 Create k8s manifests for PostgreSQL (or document managed DB usage)
- [x] 17.5 Create k8s manifests for Redis (or document managed Redis usage)
- [x] 17.6 Create Ingress resource routing external traffic to `web`
- [x] 17.7 Create Kubernetes Secrets template for OAuth credentials, DB password, encryption keys
- [x] 17.8 Configure liveness and readiness probes for all deployments
- [x] 17.9 Set resource requests/limits for all deployments
