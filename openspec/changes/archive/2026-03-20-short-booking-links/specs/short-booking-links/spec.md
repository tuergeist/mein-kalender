## ADDED Requirements

### Requirement: Short hash booking URL
Each event type SHALL support an optional short hash for anonymous booking URLs at `/B/:hash`.

#### Scenario: Access booking via short URL
- **WHEN** a visitor navigates to `/B/x7k2m`
- **THEN** the system SHALL render the booking page for the corresponding event type

#### Scenario: Invalid hash
- **WHEN** a visitor navigates to `/B/invalid`
- **THEN** the system SHALL show a "not found" message

#### Scenario: Short URL anonymity
- **WHEN** a visitor uses the short URL
- **THEN** the browser URL SHALL remain as `/B/:hash` (no redirect to long URL)

### Requirement: Hash generation and toggle
Users SHALL be able to enable/disable short links per event type. Enabling generates a unique 5-char hash.

#### Scenario: Enable short link
- **WHEN** a user enables the short link for an event type
- **THEN** the system SHALL generate a unique hash and display the short URL with a copy button

#### Scenario: Disable short link
- **WHEN** a user disables the short link
- **THEN** the hash SHALL be cleared and the short URL SHALL stop working

#### Scenario: Hash uniqueness
- **WHEN** a hash is generated that already exists
- **THEN** the system SHALL retry until a unique hash is found

### Requirement: Hash resolver API
The system SHALL provide `GET /api/public/book-by-hash/:hash` returning the username, slug, event type info, and host info.

#### Scenario: Resolve valid hash
- **WHEN** the API receives a valid hash
- **THEN** it SHALL return the event type info and host details needed to render the booking page

#### Scenario: Resolve disabled event type
- **WHEN** the hash points to a disabled event type
- **THEN** the API SHALL return 404
