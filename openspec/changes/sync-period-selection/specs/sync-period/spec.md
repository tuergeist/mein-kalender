## ADDED Requirements

### Requirement: Sync period configuration
The system SHALL allow the user to configure the forward sync window for the target calendar. The allowed values SHALL be 30, 60, or 90 days. The default value SHALL be 30 days.

#### Scenario: Setting sync period when choosing target calendar
- **WHEN** the user sets a target calendar
- **THEN** the system SHALL use the default sync period of 30 days if no period is explicitly chosen

#### Scenario: Changing sync period
- **WHEN** the user selects a different sync period (30, 60, or 90 days) in the target calendar settings
- **THEN** the system SHALL persist the new value and apply it on the next sync cycle

#### Scenario: Retrieving sync period
- **WHEN** the settings page loads and a target calendar is configured
- **THEN** the system SHALL display the currently configured sync period

### Requirement: Target sync respects configured period
The system SHALL only clone source events to the target calendar if the event's start time is within the configured `syncDaysInAdvance` window from the current date.

#### Scenario: Event within sync window
- **WHEN** a source event starts within the configured number of days from now
- **THEN** the system SHALL clone it to the target calendar

#### Scenario: Event outside sync window
- **WHEN** a source event starts beyond the configured number of days from now
- **THEN** the system SHALL NOT clone it to the target calendar

#### Scenario: Past events
- **WHEN** a source event has already ended (start time is in the past)
- **THEN** the system SHALL still clone it if it was within the original fetch window (existing behavior unchanged)

### Requirement: API accepts sync period parameter
The `PUT /api/target-calendar` endpoint SHALL accept an optional `syncDaysInAdvance` field (integer, one of 30, 60, 90). The `GET /api/target-calendar` response SHALL include the current `syncDaysInAdvance` value.

#### Scenario: Setting target with explicit period
- **WHEN** the client sends `PUT /api/target-calendar` with `{ calendarEntryId: "...", syncDaysInAdvance: 60 }`
- **THEN** the system SHALL store `syncDaysInAdvance = 60` on the target calendar entry

#### Scenario: Setting target without period
- **WHEN** the client sends `PUT /api/target-calendar` with only `{ calendarEntryId: "..." }`
- **THEN** the system SHALL use the default value of 30

#### Scenario: Invalid period value
- **WHEN** the client sends a `syncDaysInAdvance` value that is not 30, 60, or 90
- **THEN** the system SHALL return a 400 error
