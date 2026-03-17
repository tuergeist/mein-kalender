## ADDED Requirements

### Requirement: CRUD for event types
The system SHALL allow authenticated users to create, read, update, and delete event types. Each event type has: name, slug (auto-generated from name, unique per user), durationMinutes, description, location, color, and enabled flag.

#### Scenario: Create event type
- **WHEN** a user creates an event type with name "30-min Call" and duration 30
- **THEN** the system SHALL create the event type with an auto-generated slug "30-min-call"

#### Scenario: Slug uniqueness per user
- **WHEN** a user creates an event type with a slug that already exists for that user
- **THEN** the system SHALL append a numeric suffix (e.g., "30-min-call-2")

#### Scenario: List event types
- **WHEN** a user requests their event types
- **THEN** the system SHALL return all event types for that user ordered by creation date

#### Scenario: Update event type
- **WHEN** a user updates an event type's name or duration
- **THEN** the system SHALL persist the changes and keep the existing slug unchanged

#### Scenario: Delete event type
- **WHEN** a user deletes an event type
- **THEN** the system SHALL remove it and all associated future bookings SHALL be cancelled

#### Scenario: Disable event type
- **WHEN** a user disables an event type
- **THEN** the public booking page for that event type SHALL return a "not available" response
