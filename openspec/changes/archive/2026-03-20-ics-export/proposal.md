## Why

Users want to subscribe to a combined view of their calendars from external tools (Google Calendar, Apple Calendar, etc.) via ICS. For example: subscribe to an M365 calendar (which doesn't natively offer ICS) from Google Calendar. The app already has all events synced — generating an ICS feed from a configurable selection of calendars is a natural extension.

## What Changes

- **ICS feed configuration**: User creates a "feed" by selecting which calendars to include, choosing a mode (full details vs. availability/free-busy only), and days in advance
- **Persistent ICS URL**: Each feed gets a token-authenticated URL (e.g., `/api/ics-feed/<token>.ics`) that serves a standard `.ics` file
- **Feed management**: User can create, edit, delete feeds; see the subscribable URL with copy button
- **Dynamic content**: The ICS file is generated on each request from the current state of selected calendars
- **"Create ICS feed" button**: Available in the calendar view toolbar, pre-selects the currently visible calendars

## Capabilities

### New Capabilities
- `ics-feed-export`: Configurable ICS feed generation from selected calendars

### Modified Capabilities
_(none)_

## Impact

- **Database**: New `IcsFeed` model (id, userId, name, token, mode, daysInAdvance, calendarEntryIds)
- **Backend API**: CRUD for feeds + public ICS serving endpoint (token auth, no login required)
- **Frontend**: Feed management in settings or sync page; "Create ICS feed" button in calendar toolbar
