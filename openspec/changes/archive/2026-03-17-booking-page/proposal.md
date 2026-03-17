## Why

Users want to let external people (clients, colleagues, candidates) book meetings with them without back-and-forth emails. The app already has all calendar data synced — deriving availability and offering a public booking page is a natural extension. This is the core value proposition of tools like Calendly/Zeeg, but integrated directly with our unified calendar sync.

## What Changes

- **Event types**: Users can create event types (e.g. "30-min call", "1h consultation") with a name, duration, description, location/video link, and color
- **Availability rules**: Users define their working hours per weekday + can block specific dates. Availability is also derived from synced calendar events (busy = unavailable)
- **Public booking page**: Unauthenticated page at `/book/<username>/<event-type-slug>` showing a calendar picker + time slots
- **Booking flow**: Visitor picks a date → sees available time slots → fills in name, email, optional notes → confirms
- **Booking creates an event**: Confirmed booking creates an event on the user's target calendar (or a designated booking calendar) and sends a confirmation email to the visitor
- **Booking management**: User can see upcoming bookings and cancel them from the app

## Capabilities

### New Capabilities
- `event-types`: CRUD for event type definitions (name, duration, slug, description, location, color)
- `availability`: Working hours configuration + calendar-based busy detection for free slot calculation
- `booking-page`: Public-facing page with date picker, time slot list, and booking form
- `booking-management`: Listing, viewing, and cancelling bookings from the authenticated app

### Modified Capabilities
_(none)_

## Impact

- **Database**: New models: `EventType`, `AvailabilityRule`, `Booking`
- **Backend API**: New route groups: `/api/event-types`, `/api/availability`, `/api/bookings`, `/api/public/book`
- **Frontend**: New pages: `/book/[username]/[slug]` (public), `/bookings` (authenticated), event type settings
- **Auth**: Public booking routes must bypass auth middleware
- **Email**: Confirmation emails to bookers (can start with a simple transactional email or skip for MVP)
