## ADDED Requirements

### Requirement: ICS file upload
The system SHALL allow users to upload `.ics` files to import calendar events as a read-only calendar source.

#### Scenario: Upload valid ICS file
- **WHEN** a user uploads a valid `.ics` file
- **THEN** the system SHALL parse all VEVENT components and create a read-only calendar source with the imported events

#### Scenario: Upload invalid ICS file
- **WHEN** a user uploads a file that is not valid iCalendar format
- **THEN** the system SHALL reject the upload and display a validation error

#### Scenario: Overwrite on re-upload
- **WHEN** a user uploads a new `.ics` file to an existing ICS import source
- **THEN** the system SHALL replace all previously imported events with the events from the new file

### Requirement: ICS URL subscription
The system SHALL allow users to subscribe to an ICS calendar URL. The system SHALL periodically fetch the URL and update the imported events.

#### Scenario: Subscribe to ICS URL
- **WHEN** a user adds an ICS subscription URL
- **THEN** the system SHALL fetch the URL, parse the iCalendar data, and create a read-only calendar source

#### Scenario: Periodic refresh of ICS URL
- **WHEN** the refresh interval elapses for an ICS subscription
- **THEN** the system SHALL re-fetch the URL and reconcile events (add new, update changed, remove deleted)

#### Scenario: ICS URL unreachable
- **WHEN** the ICS URL is unreachable or returns an error
- **THEN** the system SHALL retain the existing imported events and mark the source with a sync error status

### Requirement: Read-only enforcement
ICS-imported calendar sources SHALL be read-only. Users SHALL NOT be able to create, edit, or delete events in ICS-imported calendars.

#### Scenario: Edit attempt on ICS event
- **WHEN** a user attempts to edit an event from an ICS import
- **THEN** the system SHALL prevent the edit and indicate that the source is read-only

#### Scenario: ICS events displayed with read-only indicator
- **WHEN** ICS-imported events are displayed in the calendar view
- **THEN** they SHALL be visually marked as read-only (e.g., different opacity or badge)
