## Context

Current layout:
- Header: Logo | [Bookings] [Settings] [Avatar dropdown]
- Sidebar: CalendarSidebar (calendar list with toggles, sync button) — only on calendar view, other pages pass no sidebar
- Pages: `/calendar`, `/settings` (monolithic), `/bookings`, `/settings/booking`, `/profile`, `/admin/*`

## Goals / Non-Goals

**Goals:**
- Clear 4-section navigation: Calendar, Bookings, Cal Sync, Settings
- Each section has a view + an edit/configure button on the page
- Sidebar always visible on desktop, collapsible on mobile
- Move target sync config out of settings into its own `/sync` page

**Non-Goals:**
- Dashboard with aggregate stats (deferred)
- Changing any backend APIs
- Changing the public booking page layout

## Decisions

### 1. Sidebar structure

The sidebar has two zones:
- **Top**: Navigation links (Calendar, Bookings, Cal Sync, Settings). Active link highlighted.
- **Bottom zone (contextual)**: On the Calendar page, show the calendar list with toggles below the nav links. On other pages, nav links only.

This keeps the calendar toggle list accessible without cluttering other views.

### 2. AppShell rework

`AppShell` gets a `section` prop to highlight the active nav item. The sidebar renders:
1. Nav links (always)
2. Optional contextual content below (e.g., CalendarSidebar on calendar page)

The header keeps: logo, admin link (if admin role), avatar dropdown. Remove Bookings and Settings text links. Hide burger button on `md:` and up (sidebar always visible).

### 3. Page mapping

| Sidebar item | Route | Content | Edit button goes to |
|-------------|-------|---------|-------------------|
| Calendar | `/calendar` | FullCalendar view | Source management (inline or modal) |
| Bookings | `/bookings` | Upcoming/past bookings list | `/settings/booking` (event types, availability) |
| Cal Sync | `/sync` | Target sync config (calendar, period, filters, source selection) | Inline (it IS the config) |
| Settings | `/settings` | Map provider, profile link | Inline |

### 4. New `/sync` page

Extract the entire "Target Calendar" card from `/settings` into `/sync`. This includes:
- Target calendar selector
- Sync period (30/60/90)
- Filter toggles (skip work location, single-day all-day, declined, free)
- Source calendar selection checkboxes
- Save button
- Cleanup section

The settings page no longer has this section.

### 5. Settings page becomes minimal

After extracting sync config:
- Booking Page card (link to `/settings/booking`)
- Map Provider selector
- That's it. Profile is accessible via avatar dropdown.

## Risks / Trade-offs

- **Bookmark breakage**: `/settings` still exists but has less content. No URLs removed, just moved.
- **Calendar sidebar only on calendar page**: Users used to seeing calendar toggles on all pages won't see them elsewhere. This is intentional — calendar toggles are only relevant on the calendar view.
