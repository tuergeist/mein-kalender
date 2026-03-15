## ADDED Requirements

### Requirement: Provider metadata captures response status
Both Google and Outlook providers SHALL store a normalized `responseStatus` field in `providerMetadata` with one of: `accepted`, `declined`, `tentative`, `needsAction`.

#### Scenario: Google event with self attendee declined
- **WHEN** a Google calendar event has an attendee with `self: true` and `responseStatus: "declined"`
- **THEN** the event's `providerMetadata.responseStatus` SHALL be `"declined"`

#### Scenario: Outlook event with declined response
- **WHEN** an Outlook event has `responseStatus.response` of `"declined"`
- **THEN** the event's `providerMetadata.responseStatus` SHALL be `"declined"`

#### Scenario: Google event with no attendees
- **WHEN** a Google event has no `attendees` array (e.g., self-created event with no invitees)
- **THEN** `providerMetadata.responseStatus` SHALL be `"accepted"`

#### Scenario: Outlook organizer event
- **WHEN** an Outlook event has `responseStatus.response` of `"organizer"`
- **THEN** the event's `providerMetadata.responseStatus` SHALL be `"accepted"`

### Requirement: Provider metadata captures show-as status
Both providers SHALL store a normalized `showAs` field in `providerMetadata` with one of: `free`, `tentative`, `busy`.

#### Scenario: Google transparent event
- **WHEN** a Google event has `transparency: "transparent"`
- **THEN** the event's `providerMetadata.showAs` SHALL be `"free"`

#### Scenario: Google opaque event
- **WHEN** a Google event has `transparency: "opaque"` or no transparency field
- **THEN** the event's `providerMetadata.showAs` SHALL be `"busy"`

#### Scenario: Outlook free event
- **WHEN** an Outlook event has `showAs: "free"`
- **THEN** the event's `providerMetadata.showAs` SHALL be `"free"`

#### Scenario: Outlook tentative event
- **WHEN** an Outlook event has `showAs: "tentative"`
- **THEN** the event's `providerMetadata.showAs` SHALL be `"tentative"`

#### Scenario: Outlook busy/oof event
- **WHEN** an Outlook event has `showAs` of `"busy"`, `"oof"`, or `"workingElsewhere"`
- **THEN** the event's `providerMetadata.showAs` SHALL be `"busy"`

### Requirement: Skip declined events filter
The system SHALL support a `skipDeclined` setting (default true) on the target calendar. When enabled, events with `providerMetadata.responseStatus === "declined"` SHALL NOT be cloned to the target.

#### Scenario: Declined event with filter on
- **WHEN** `skipDeclined` is true and a source event has `responseStatus: "declined"`
- **THEN** the event SHALL NOT be cloned to the target calendar

#### Scenario: Declined event with filter off
- **WHEN** `skipDeclined` is false and a source event has `responseStatus: "declined"`
- **THEN** the event SHALL be cloned to the target calendar

#### Scenario: Event without response status metadata
- **WHEN** `skipDeclined` is true and a source event has no `responseStatus` in metadata
- **THEN** the event SHALL still be cloned (not filtered out)

### Requirement: Skip free/tentative events filter
The system SHALL support a `skipFree` setting (default false) on the target calendar. When enabled, events with `showAs` of `"free"` or `"tentative"` (or legacy `transparency: "transparent"`) SHALL NOT be cloned.

#### Scenario: Free event with filter on
- **WHEN** `skipFree` is true and a source event has `showAs: "free"`
- **THEN** the event SHALL NOT be cloned to the target calendar

#### Scenario: Tentative event with filter on
- **WHEN** `skipFree` is true and a source event has `showAs: "tentative"`
- **THEN** the event SHALL NOT be cloned to the target calendar

#### Scenario: Busy event with filter on
- **WHEN** `skipFree` is true and a source event has `showAs: "busy"`
- **THEN** the event SHALL be cloned to the target calendar

#### Scenario: Free event with filter off
- **WHEN** `skipFree` is false and a source event has `showAs: "free"`
- **THEN** the event SHALL be cloned to the target calendar

### Requirement: API accepts filter parameters
The `PUT /api/target-calendar` endpoint SHALL accept optional `skipDeclined` and `skipFree` boolean fields. The `GET /api/target-calendar` response SHALL include both values.

#### Scenario: Setting target with filters
- **WHEN** the client sends `PUT /api/target-calendar` with `{ calendarEntryId: "...", skipDeclined: true, skipFree: true }`
- **THEN** both filter values SHALL be persisted on the target calendar entry

#### Scenario: Setting target without filters
- **WHEN** the client sends `PUT /api/target-calendar` without filter fields
- **THEN** the system SHALL use defaults (`skipDeclined: true`, `skipFree: false`)
