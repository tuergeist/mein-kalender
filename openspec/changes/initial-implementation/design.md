## Context

This is a greenfield calendar synchronization platform. Users manage calendars across Google Calendar, Microsoft 365 Outlook, and Proton Calendar but have no unified view. The system must sync events across providers, present a unified calendar UI, and run on Kubernetes. Multi-tenant from the start.

The user has chosen HeroUI (React/Tailwind CSS component library) for the frontend.

## Goals / Non-Goals

**Goals:**
- Unified calendar view aggregating events from Google, Outlook, and Proton
- One-way sync (clone) from source calendars to a target calendar with automatic delete propagation
- Edit events from the unified UI, propagating changes back to the source provider
- Read-only ICS import (file upload and URL subscription)
- Multi-tenant with per-user calendar source configuration
- Responsive, mobile-friendly web UI using HeroUI
- Kubernetes-ready Docker deployment

**Non-Goals:**
- Booking page feature (documented as future scope, not designed here)
- Two-way merge sync between providers (only source → target cloning)
- Native mobile apps
- Admin interface (planned for future iteration)
- Billing/payment integration (architecture should not block it, but not implemented now)
- Self-hosted email/notification system (rely on provider notifications)
- Real-time collaborative editing of events

## Decisions

### 1. Frontend: Next.js + HeroUI + FullCalendar

**Choice:** Next.js App Router with HeroUI components and FullCalendar for the calendar grid.

**Rationale:** HeroUI is built for Next.js with Tailwind CSS and React Aria (accessibility). It provides 50+ components for forms, navigation, modals, etc. — but not a calendar grid widget. FullCalendar (open source, React wrapper available) fills that gap with day/week/month views, drag-and-drop, and mobile support.

**Alternatives considered:**
- Custom calendar grid — too much effort for a standard view; FullCalendar is battle-tested
- Nuxt/Vue — user chose HeroUI which is React-based

### 2. Backend: Node.js (TypeScript) with Fastify

**Choice:** TypeScript backend using Fastify, sharing types with the Next.js frontend via a shared package.

**Rationale:** Single language across the stack reduces context switching. Fastify is fast, has good TypeScript support, and a mature plugin ecosystem for OAuth, validation, and scheduling. The sync engine needs background job processing (see Decision 4).

**Alternatives considered:**
- Go — great for concurrency but loses the shared-types advantage with a TS frontend
- Next.js API routes only — insufficient for background sync jobs and long-running processes

### 3. Database: PostgreSQL

**Choice:** PostgreSQL with Prisma ORM.

**Rationale:** Relational model fits well: users → calendar_sources → synced_events. JSONB columns for provider-specific metadata. Prisma provides type-safe queries and migration management. PostgreSQL is well-supported on k8s (via operators or managed services).

**Alternatives considered:**
- SQLite — doesn't scale for multi-tenant, no concurrent write support needed for sync
- MongoDB — relational structure of calendars/events/users maps naturally to SQL

### 4. Sync Architecture: Poll-based with BullMQ

**Choice:** Periodic polling via BullMQ (Redis-backed job queue) with per-source configurable intervals.

**Rationale:** All three providers support polling. Google and Outlook support push notifications (webhooks) but Proton does not have a public webhook API. Starting with polling provides a uniform approach. BullMQ handles scheduling, retries, and concurrency limiting per tenant.

Future enhancement: add webhook listeners for Google/Outlook to reduce latency and API calls.

**Alternatives considered:**
- Webhook-only — Proton doesn't support it; would need polling fallback anyway
- Cron jobs — no retry logic, no concurrency control, harder to manage per-tenant

### 5. Provider Integration Pattern: Adapter Interface

**Choice:** Define a `CalendarProvider` interface with implementations for each provider (Google, Outlook, Proton).

```
interface CalendarProvider {
  authenticate(credentials): Promise<TokenSet>
  listCalendars(token): Promise<Calendar[]>
  getEvents(token, calendarId, syncToken?): Promise<EventDelta>
  createEvent(token, calendarId, event): Promise<Event>
  updateEvent(token, calendarId, eventId, event): Promise<Event>
  deleteEvent(token, calendarId, eventId): Promise<void>
}
```

**Rationale:** Encapsulates provider-specific API differences (REST vs GraphQL vs Bridge). Sync engine operates against the interface, making it testable and extensible. Each adapter handles its own token refresh logic.

**Alternatives considered:**
- Single monolithic sync function — would become unmaintainable with 3+ providers

### 6. Authentication: NextAuth.js with per-provider OAuth

**Choice:** NextAuth.js for user login with a dedicated sign-up/registration flow (email + password and/or social login via Google/Microsoft). Separate OAuth flows for connecting calendar sources (stored per user, encrypted at rest).

**Rationale:** Users sign up with their own account first, then connect calendar providers independently. A user might register with email but connect Google, Outlook, and Proton calendars. The sign-up flow is a first-class feature (not just OAuth redirect) to support future monetization — user accounts need to exist as proper entities with profile data, not just OAuth sessions. NextAuth.js handles session management. Calendar OAuth tokens are stored separately in the DB, encrypted with a per-tenant key.

The user model should be extensible for future billing (subscription tier, usage tracking) and admin roles, though neither is implemented now.

### 7. Monorepo Structure: Turborepo

**Choice:** Turborepo monorepo with packages for `web` (Next.js), `api` (Fastify), `shared` (types/utils), and `sync-worker` (BullMQ processor).

**Rationale:** Shared TypeScript types between frontend and backend. Turborepo provides caching and parallel builds. Each package gets its own Dockerfile for independent k8s deployment.

### 8. Proton Calendar: proton-mail-bridge approach

**Choice:** Use Proton's CalDAV interface via proton-mail-bridge or direct API if available.

**Rationale:** Proton doesn't have a public REST API for calendar. The bridge exposes CalDAV which can be consumed via a CalDAV client library. If Proton releases a public API, the adapter can be swapped without changing the sync engine.

## Risks / Trade-offs

- **Proton Calendar integration complexity** → Proton's lack of public API means relying on bridge/CalDAV, which may be fragile. Mitigation: make Proton adapter optional, gracefully degrade if bridge is unavailable.
- **OAuth token management** → Managing tokens for 3 providers per user is complex (refresh flows, revocation, expiry). Mitigation: centralized token service with automatic refresh, encrypted storage, clear error states in UI.
- **Polling latency** → Changes on source calendars may take up to the poll interval to appear. Mitigation: configurable intervals (default 5 min), manual "sync now" button in UI, future webhook support for Google/Outlook.
- **FullCalendar bundle size** → FullCalendar adds significant JS weight. Mitigation: lazy-load calendar view, use tree-shaking, only import needed plugins.
- **Multi-tenant data isolation** → All tenants share one DB. Mitigation: row-level security via Prisma middleware filtering on userId, audit logging for data access.
- **Redis dependency** → BullMQ requires Redis. Mitigation: Redis is lightweight and well-supported on k8s; can use managed Redis in production.

## Open Questions

- Should we support CalDAV as a generic provider (enabling Nextcloud, Fastmail, etc.) or only the three named providers initially?
- What is the desired default sync interval? (5 min proposed)
- Should the target/unified calendar be a virtual view (aggregation at query time) or a physical copy (cloned events in DB)?
- Proton bridge availability in containerized environments — does it run headless in Docker?
