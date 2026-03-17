## Why

The current navigation is flat and cluttered — settings is a monolithic page, bookings and sync config are buried, and the sidebar only shows a calendar list. As the app grows (booking pages, sync filters, per-calendar selection), users need a clearer structure to find and manage each concern.

## What Changes

- **Sidebar navigation**: Replace the calendar-only sidebar with a permanent nav sidebar containing: Calendar, Bookings, Cal Sync, Settings. Each section is a top-level page.
- **Top nav cleanup**: Remove Bookings and Settings links from the header. Hide burger menu button on desktop (sidebar always visible). Keep logo, admin link (if admin), and avatar dropdown.
- **Calendar page** (`/calendar`): Calendar view as today. Sidebar shows calendar list (sources + entries with toggles). Add an edit/settings icon that links to source management (add/rename/disconnect calendars).
- **Bookings page** (`/bookings`): Shows upcoming/past bookings. Add an edit/settings icon linking to `/settings/booking` (event types, availability, username).
- **Cal Sync page** (`/sync`): New page showing the target calendar sync configuration inline — target calendar selector, sync period, filters, source calendar selection. Currently this is buried in the settings page.
- **Settings page** (`/settings`): Slimmed down to: map provider, user profile, and anything else not covered by the other sections.
- **Responsive**: On mobile, sidebar collapses as today (burger toggle). On desktop, sidebar is always visible (no burger button needed).

## Capabilities

### New Capabilities
- `nav-layout`: Sidebar navigation with section-based page structure

### Modified Capabilities
_(none — this is a frontend-only restructuring)_

## Impact

- **Frontend only**: No backend API changes
- **AppShell**: Major rework — sidebar becomes navigation + contextual content
- **Settings page**: Split — sync config moves to `/sync`, booking config stays at `/settings/booking`, sources stay linked from calendar page
- **New page**: `/sync` for target calendar sync configuration
- **Middleware**: Add `/sync/:path*` to protected routes
