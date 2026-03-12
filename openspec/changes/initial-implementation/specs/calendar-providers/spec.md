## ADDED Requirements

### Requirement: Provider adapter interface
The system SHALL define a `CalendarProvider` interface that all provider integrations implement. The interface SHALL include methods for authentication, listing calendars, fetching event deltas, and CRUD operations on events. Each adapter SHALL handle provider-specific API differences (REST, GraphQL, CalDAV) behind this uniform interface.

#### Scenario: Adapter implements full interface
- **WHEN** a new provider adapter is registered
- **THEN** it SHALL implement `authenticate`, `listCalendars`, `getEvents`, `createEvent`, `updateEvent`, and `deleteEvent` methods

#### Scenario: Provider-specific errors are normalized
- **WHEN** a provider API returns a provider-specific error (e.g., Google 403, Outlook 401)
- **THEN** the adapter SHALL translate it into a standardized error type (e.g., `AuthExpired`, `RateLimited`, `NotFound`)

### Requirement: Google Calendar integration
The system SHALL integrate with Google Calendar API v3. Users SHALL be able to connect their Google account via OAuth 2.0, list their Google calendars, and perform full CRUD on events.

#### Scenario: Google OAuth connection
- **WHEN** a user initiates Google Calendar connection
- **THEN** the system SHALL redirect to Google OAuth consent screen with `calendar.events` and `calendar.readonly` scopes
- **THEN** upon approval, the system SHALL store the access token and refresh token encrypted in the database

#### Scenario: Google token refresh
- **WHEN** a Google access token has expired
- **THEN** the adapter SHALL automatically refresh it using the stored refresh token before retrying the API call

#### Scenario: List Google calendars
- **WHEN** the system requests the user's Google calendars
- **THEN** the adapter SHALL return all calendars the user has access to, including shared calendars, with their IDs, names, and color

#### Scenario: CRUD operations on Google events
- **WHEN** an event is created, updated, or deleted via the Google adapter
- **THEN** the adapter SHALL call the corresponding Google Calendar API endpoint and return the result in the normalized event format

### Requirement: Microsoft 365 Outlook integration
The system SHALL integrate with Microsoft Graph API for Outlook Calendar. Users SHALL be able to connect their Microsoft 365 account via OAuth 2.0, list their Outlook calendars, and perform full CRUD on events.

#### Scenario: Microsoft OAuth connection
- **WHEN** a user initiates Microsoft 365 connection
- **THEN** the system SHALL redirect to Microsoft identity platform with `Calendars.ReadWrite` scope
- **THEN** upon approval, the system SHALL store the access token and refresh token encrypted in the database

#### Scenario: Microsoft token refresh
- **WHEN** a Microsoft access token has expired
- **THEN** the adapter SHALL automatically refresh it using the stored refresh token

#### Scenario: List Outlook calendars
- **WHEN** the system requests the user's Outlook calendars
- **THEN** the adapter SHALL return all calendars from Microsoft Graph `/me/calendars` with their IDs, names, and color

#### Scenario: CRUD operations on Outlook events
- **WHEN** an event is created, updated, or deleted via the Outlook adapter
- **THEN** the adapter SHALL call the corresponding Microsoft Graph API endpoint and return the result in the normalized event format

### Requirement: Proton Calendar integration
The system SHALL integrate with Proton Calendar via CalDAV (through proton-mail-bridge or equivalent). Users SHALL be able to connect their Proton account, list their Proton calendars, and read events. Write operations SHALL be supported if the CalDAV interface allows it.

#### Scenario: Proton connection via bridge credentials
- **WHEN** a user initiates Proton Calendar connection
- **THEN** the system SHALL accept bridge connection credentials (host, port, username, password)
- **THEN** the system SHALL verify the CalDAV connection and store credentials encrypted

#### Scenario: List Proton calendars
- **WHEN** the system requests the user's Proton calendars
- **THEN** the adapter SHALL enumerate CalDAV calendars from the bridge endpoint

#### Scenario: Read Proton events
- **WHEN** the system fetches events from a Proton calendar
- **THEN** the adapter SHALL retrieve VEVENT components via CalDAV REPORT and convert them to the normalized event format

#### Scenario: Proton bridge unavailable
- **WHEN** the Proton bridge endpoint is unreachable
- **THEN** the adapter SHALL return a connection error and the sync engine SHALL skip this source without failing other sources

### Requirement: Token encryption at rest
The system SHALL encrypt all stored OAuth tokens and provider credentials using AES-256 encryption with a per-tenant key before persisting to the database.

#### Scenario: Token storage
- **WHEN** OAuth tokens or credentials are saved to the database
- **THEN** they SHALL be encrypted with the tenant's encryption key
- **THEN** plaintext tokens SHALL never be written to the database

#### Scenario: Token retrieval
- **WHEN** the system needs to use stored tokens
- **THEN** it SHALL decrypt them in memory only for the duration of the API call
