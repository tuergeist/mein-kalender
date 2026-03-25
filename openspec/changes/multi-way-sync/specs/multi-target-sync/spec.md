## ADDED Requirements

### Requirement: Multiple target calendars
The system SHALL allow a user to configure multiple calendar entries as sync targets. Each target has its own set of source calendars, filters, and sync mode.

#### Scenario: User configures two targets
- **WHEN** a user marks calendar A as a target with sources B and C, and marks calendar B as a target with source A
- **THEN** the sync engine SHALL clone events from B,C → A and from A → B independently

#### Scenario: Target with no sources configured
- **WHEN** a target calendar has no source calendars selected
- **THEN** the system SHALL sync from all enabled source calendars (default behavior)

### Requirement: Sync mode per target
Each target calendar SHALL have a `syncMode` setting: "full" (default) or "blocked".

#### Scenario: Full sync mode
- **WHEN** a target has `syncMode: "full"`
- **THEN** cloned events SHALL include the original title, description, and location prefixed with `[Sync]`

#### Scenario: Blocked sync mode
- **WHEN** a target has `syncMode: "blocked"`
- **THEN** cloned events SHALL have title `[Sync] Busy` with no description and no location

#### Scenario: Blocked mode update
- **WHEN** a source event is updated and the target uses blocked mode
- **THEN** the target event SHALL be updated with start/end time changes but title remains `[Sync] Busy`

### Requirement: Loop prevention
The system SHALL NOT sync events that were themselves synced from another calendar. Events with titles starting with `[Sync]` SHALL be excluded from the unmapped events query.

#### Scenario: Synced event not re-synced
- **WHEN** calendar A has an event `[Sync] Team Meeting` that was cloned from calendar B
- **THEN** when syncing A → B, the system SHALL skip this event

#### Scenario: Original event with Sync prefix
- **WHEN** a user manually creates an event titled `[Sync] Something` on a source calendar
- **THEN** the system SHALL treat it like any synced event and skip it (acceptable false positive)

### Requirement: Multi-target API
The system SHALL provide CRUD endpoints for managing sync targets.

#### Scenario: List targets
- **WHEN** a user calls `GET /api/sync-targets`
- **THEN** the system SHALL return all calendar entries with `isTarget: true` for the user, including their source calendars, filters, and sync mode

#### Scenario: Create target
- **WHEN** a user calls `POST /api/sync-targets` with a calendar entry ID, source calendar IDs, sync mode, and filter settings
- **THEN** the system SHALL mark the calendar entry as a target with the specified configuration

#### Scenario: Update target
- **WHEN** a user calls `PUT /api/sync-targets/:id` with updated source calendars or sync mode
- **THEN** the system SHALL update the target configuration

#### Scenario: Delete target
- **WHEN** a user calls `DELETE /api/sync-targets/:id`
- **THEN** the system SHALL unmark the calendar entry as a target, delete all its target event mappings, and optionally clean up synced events on the provider

### Requirement: Independent filter sets per target
Each target calendar SHALL have its own filter configuration (skipDeclined, skipFree, skipWorkLocation, skipSingleDayAllDay, syncDaysInAdvance).

#### Scenario: Different filters per target
- **WHEN** target A has `skipFree: true` and target B has `skipFree: false`
- **THEN** free events SHALL be excluded from A but included in B
