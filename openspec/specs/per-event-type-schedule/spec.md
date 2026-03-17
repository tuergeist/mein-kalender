## ADDED Requirements

### Requirement: Per-event-type booking calendar
Each event type SHALL support an optional `bookingCalendarEntryId` specifying which calendar to create booking events in.

#### Scenario: Event type has booking calendar set
- **WHEN** a booking is created for an event type with `bookingCalendarEntryId` set
- **THEN** the booking event SHALL be created on that calendar

#### Scenario: Event type has no booking calendar
- **WHEN** a booking is created for an event type without a booking calendar
- **THEN** the system SHALL fall back to the user's global booking calendar, then target calendar, then first writable

### Requirement: Per-event-type working hours
Each event type SHALL support its own 7-day availability schedule. When no custom schedule exists, the user's default schedule SHALL be used.

#### Scenario: Event type has custom working hours
- **WHEN** an event type has availability rules with its `eventTypeId`
- **THEN** slot computation SHALL use those rules instead of the user defaults

#### Scenario: Event type has no custom working hours
- **WHEN** an event type has no availability rules (no rows with its eventTypeId)
- **THEN** slot computation SHALL fall back to the user's default rules (eventTypeId = null)

#### Scenario: Set custom working hours via API
- **WHEN** the client sends `PUT /api/event-types/:id` with `availabilityRules` array
- **THEN** the system SHALL upsert 7 rules with the given eventTypeId

### Requirement: API exposes per-type configuration
The event type GET and PUT endpoints SHALL include `bookingCalendarEntryId` and `availabilityRules` in the response and accept them in updates.

#### Scenario: Get event type with custom schedule
- **WHEN** the client fetches an event type that has custom availability rules
- **THEN** the response SHALL include the rules in an `availabilityRules` array

#### Scenario: Get event type without custom schedule
- **WHEN** the client fetches an event type with no custom rules
- **THEN** `availabilityRules` SHALL be an empty array (frontend shows user defaults)
