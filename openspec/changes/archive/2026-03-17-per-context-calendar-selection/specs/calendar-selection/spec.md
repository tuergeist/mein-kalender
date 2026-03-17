## ADDED Requirements

### Requirement: Target sync respects selected source calendars
The target calendar sync SHALL only clone events from source calendars that are in the configured selection. If no selection is configured (empty), all enabled source calendars SHALL be used.

#### Scenario: Specific calendars selected
- **WHEN** the target calendar has source calendars [A, B] selected
- **THEN** `cloneToTarget` SHALL only clone events from calendar entries A and B

#### Scenario: No selection (default)
- **WHEN** the target calendar has no source calendars selected (empty array)
- **THEN** `cloneToTarget` SHALL clone from all enabled, non-target calendar entries (current behavior)

#### Scenario: Selected calendar is disabled
- **WHEN** a selected source calendar has `enabled: false`
- **THEN** events from that calendar SHALL still be cloned (explicit selection overrides enabled flag)

### Requirement: Booking availability respects selected calendars
Each event type SHALL support a configurable list of calendar entries to check for busy/free conflicts. If no selection is configured (empty), all enabled calendars SHALL be used.

#### Scenario: Specific calendars selected for event type
- **WHEN** event type "Office Hours" has calendars [Work, Meetings] selected
- **THEN** slot computation SHALL only check events from those calendars for conflicts

#### Scenario: No selection (default)
- **WHEN** an event type has no calendars selected (empty array)
- **THEN** slot computation SHALL check all enabled calendars (current behavior)

### Requirement: API accepts calendar selection
The `PUT /api/target-calendar` endpoint SHALL accept an optional `sourceCalendarEntryIds` array. The `PUT /api/event-types/:id` endpoint SHALL accept an optional `calendarEntryIds` array. GET responses SHALL include the current selections.

#### Scenario: Set target sync calendars
- **WHEN** the client sends `PUT /api/target-calendar` with `sourceCalendarEntryIds: ["id1", "id2"]`
- **THEN** the target calendar entry SHALL be associated with those source calendars

#### Scenario: Reset to all calendars
- **WHEN** the client sends `sourceCalendarEntryIds: []`
- **THEN** the selection SHALL be cleared (meaning "use all enabled")

#### Scenario: Set event type calendars
- **WHEN** the client sends `PUT /api/event-types/:id` with `calendarEntryIds: ["id1"]`
- **THEN** that event type SHALL only check the specified calendar for conflicts

### Requirement: UI shows calendar selection
The target calendar settings and event type edit modal SHALL each include a multi-select calendar picker showing all the user's calendar entries.

#### Scenario: No calendars selected in UI
- **WHEN** the user has not selected any specific calendars
- **THEN** the UI SHALL show "All calendars" as the default state

#### Scenario: User selects specific calendars
- **WHEN** the user checks specific calendars in the picker
- **THEN** only those calendars SHALL be sent in the API request
