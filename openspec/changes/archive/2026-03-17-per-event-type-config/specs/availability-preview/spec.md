## ADDED Requirements

### Requirement: Availability preview API
The system SHALL provide a `GET /api/event-types/:id/availability-preview?week=YYYY-MM-DD` endpoint returning a 7-day breakdown of working hours, busy events, existing bookings, and available slots.

#### Scenario: Fetch preview for a week
- **WHEN** the client requests availability preview for event type X and week starting 2026-03-16
- **THEN** the response SHALL include 7 days, each with working hours, busy blocks (with calendar name/color), bookings, and computed available slots

#### Scenario: Day outside working hours
- **WHEN** a day has working hours disabled
- **THEN** that day SHALL show no available slots and `workingHours.enabled = false`

### Requirement: Availability preview UI
The event type settings SHALL include a visual availability preview showing a week view with color-coded blocks.

#### Scenario: View availability preview
- **WHEN** the user opens the availability preview for an event type
- **THEN** the UI SHALL show working hours, busy events (colored by source), bookings, and free slots for the selected week

#### Scenario: Navigate weeks
- **WHEN** the user clicks next/previous week
- **THEN** the preview SHALL update to show that week's availability
