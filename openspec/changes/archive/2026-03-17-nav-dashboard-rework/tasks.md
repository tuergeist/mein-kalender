## 1. AppShell Rework

- [x] 1.1 Add `section` prop to AppShell for active nav highlighting (calendar, bookings, sync, settings)
- [x] 1.2 Replace sidebar content with: nav links (Calendar, Bookings, Cal Sync, Settings) at top + optional children below
- [x] 1.3 Hide burger menu button on `md:` and up (sidebar always visible on desktop)
- [x] 1.4 Remove Bookings and Settings text links from the header — keep logo, admin link, avatar dropdown only
- [x] 1.5 Style active nav link (highlight background/text)

## 2. Calendar Page

- [x] 2.1 Pass `section="calendar"` to AppShell
- [x] 2.2 Pass CalendarSidebar as sidebar children (calendar list renders below nav links)
- [x] 2.3 Add edit/settings icon button on the calendar page header linking to source management (`/settings` sources section or inline)

## 3. New `/sync` Page

- [x] 3.1 Create `/sync/page.tsx` with target sync configuration extracted from settings page
- [x] 3.2 Include: target calendar selector, sync period (30/60/90 days), filter toggles, source calendar selection, save button, cleanup section
- [x] 3.3 Pass `section="sync"` to AppShell
- [x] 3.4 Add `/sync/:path*` to middleware matcher

## 4. Bookings Page

- [x] 4.1 Pass `section="bookings"` to AppShell
- [x] 4.2 Add edit/settings icon button in the page header linking to `/settings/booking`

## 5. Settings Page Cleanup

- [x] 5.1 Remove the Target Calendar card from settings page (moved to `/sync`)
- [x] 5.2 Keep: Booking Page link card, Map Provider card, Calendar Sources card (add/rename/disconnect)
- [x] 5.3 Pass `section="settings"` to AppShell

## 6. Other Pages

- [x] 6.1 Update `/settings/booking` to pass `section="bookings"` to AppShell
- [x] 6.2 Update admin pages to pass appropriate section (or none)
- [x] 6.3 Update profile page to pass `section="settings"`

## 7. Source Fetch Window (bonus)

- [x] 7.1 Add `fetchDaysInAdvance` column to CalendarSource (default 90)
- [x] 7.2 Update sources PUT API to accept `fetchDaysInAdvance` (30/60/90)
- [x] 7.3 Pass `fetchDaysInAdvance` through sync chain to provider `getEvents`
- [x] 7.4 Google: add `timeMax` param on initial sync
- [x] 7.5 Outlook: use `fetchDaysInAdvance` instead of hardcoded 365 days
- [x] 7.6 Add Source Fetch Window card to `/sync` page
- [x] 7.7 Warn user when sync period > fetch window, offer to raise it
