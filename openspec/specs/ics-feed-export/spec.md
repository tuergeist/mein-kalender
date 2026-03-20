## ADDED Requirements

### Requirement: Create ICS feed
The system SHALL allow users to create ICS feeds with a name, mode (full/freebusy), days in advance, and selected calendars.

#### Scenario: Create feed with full details
- **WHEN** a user creates a feed with mode "full" and calendars [A, B]
- **THEN** the system SHALL generate a token and return the subscribable URL

#### Scenario: Create feed from calendar view
- **WHEN** a user clicks "Export ICS" in the calendar toolbar
- **THEN** the feed creation modal SHALL pre-select the currently visible calendars

### Requirement: Serve ICS feed
The system SHALL serve a valid `.ics` file at `GET /api/ics-feed/:token.ics` without requiring authentication.

#### Scenario: Full details mode
- **WHEN** an ICS feed is requested with mode "full"
- **THEN** the response SHALL contain VEVENT entries with SUMMARY, DESCRIPTION, and LOCATION

#### Scenario: Free/busy mode
- **WHEN** an ICS feed is requested with mode "freebusy"
- **THEN** the response SHALL contain VEVENT entries with SUMMARY "Busy" and no description/location

#### Scenario: Invalid token
- **WHEN** an ICS feed is requested with an invalid token
- **THEN** the system SHALL return 404

#### Scenario: Date range
- **WHEN** an ICS feed has daysInAdvance set to 30
- **THEN** only events from now to 30 days ahead SHALL be included

### Requirement: Manage ICS feeds
The system SHALL allow users to list, edit, and delete their ICS feeds.

#### Scenario: List feeds
- **WHEN** a user views their feeds
- **THEN** the system SHALL show all feeds with name, mode, and subscribable URL

#### Scenario: Delete feed
- **WHEN** a user deletes a feed
- **THEN** the feed URL SHALL stop working immediately

### Requirement: Feed URL with copy button
Each feed SHALL display its subscribable URL with a copy-to-clipboard button.

#### Scenario: Copy URL
- **WHEN** a user clicks the copy button on a feed
- **THEN** the full ICS feed URL SHALL be copied to the clipboard
