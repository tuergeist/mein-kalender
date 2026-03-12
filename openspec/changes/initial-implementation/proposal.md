## Why

Managing multiple calendars across Google Calendar, Microsoft 365 Outlook, and Proton is fragmented — there's no unified view and no way to keep them in sync. A centralized calendar sync system eliminates the need to check multiple providers and enables a single pane of glass for all scheduling.

## What Changes

- Build a new multi-provider calendar synchronization backend that connects to Google Calendar, Microsoft 365 Outlook, and Proton Calendar APIs
- Implement one-way sync (clone) of events from source calendars into a target calendar, including automatic deletion when source events are removed
- Build a responsive web UI with a visually appealing calendar display that works on desktop and mobile
- Support editing events directly from the unified UI (propagating changes back to the source calendar)
- Support read-only calendar import via ICS files/URLs
- Multi-tenant architecture so multiple users can each configure their own calendar sources
- Containerized deployment targeting Kubernetes (Docker images, Helm charts or manifests)
- Optional: booking page feature for individual calendars (future scope)

## Capabilities

### New Capabilities

- `calendar-providers`: Integration with Google Calendar, Microsoft 365 Outlook, and Proton Calendar APIs — OAuth flows, token management, and CRUD operations for calendar events
- `sync-engine`: Core synchronization logic — polling/webhook-based change detection, one-way cloning of events to a target calendar, propagation of deletes, and conflict handling
- `calendar-ui`: Responsive web-based calendar interface — unified calendar view, event display, inline event editing, and mobile support
- `ics-import`: Read-only import of external calendars via ICS file upload or URL subscription
- `multi-tenancy`: User sign-up/registration, authentication, per-user calendar source configuration, and tenant isolation — designed with future monetization in mind
- `deployment`: Docker containerization, Kubernetes manifests/Helm charts, and configuration management

### Modified Capabilities

(none — greenfield project)

## Impact

- **New codebase**: Entire application is new — backend service, frontend SPA, database schema
- **External APIs**: Google Calendar API, Microsoft Graph API (Outlook), Proton Calendar API (bridge or API)
- **Dependencies**: OAuth2 libraries, calendar parsing (iCal), UI framework, database (for sync state and tenant data)
- **Infrastructure**: Requires k8s cluster, persistent storage for sync metadata, secrets management for OAuth credentials
