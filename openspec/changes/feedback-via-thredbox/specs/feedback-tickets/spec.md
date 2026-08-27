## ADDED Requirements

### Requirement: A report is stored before it is sent anywhere
The system SHALL persist a submitted report before attempting to create a ticket for it, and SHALL keep the report when ticket creation fails.

#### Scenario: Report accepted
- **WHEN** an authenticated user submits a report with a title of at least three characters
- **THEN** the system SHALL store it with the reporter, the type, the title, the description and an initial status, and SHALL confirm receipt

#### Scenario: Ticket system unreachable
- **WHEN** the ticket system cannot be reached while a report is being submitted
- **THEN** the system SHALL keep the stored report without a ticket reference and SHALL still confirm receipt to the reporter

#### Scenario: Ticket system rejects the request
- **WHEN** the ticket system answers with an error, including a rate-limit refusal
- **THEN** the system SHALL keep the stored report without a ticket reference and SHALL still confirm receipt

#### Scenario: Title too short
- **WHEN** a report is submitted with a title shorter than three characters
- **THEN** the system SHALL reject it and store nothing

#### Scenario: Not signed in
- **WHEN** an unauthenticated request submits a report
- **THEN** the system SHALL reject it

### Requirement: A stored report opens a ticket
The system SHALL create one ticket per stored report and SHALL record the returned ticket reference and token against it.

#### Scenario: Ticket created
- **WHEN** a report is stored and the ticket system accepts it
- **THEN** the system SHALL record the ticket id, the ticket token and the reported status against that report

#### Scenario: Title leads the ticket text
- **WHEN** a ticket is created
- **THEN** the report's title SHALL be the first line of the ticket message, because that line becomes the subject in the handling channel

#### Scenario: Reporter identity travels as metadata
- **WHEN** a ticket is created
- **THEN** the reporter's identity and the report's identifier SHALL be sent as ticket metadata rather than inside the message text

#### Scenario: Report type maps to a ticket type
- **WHEN** a report of type bug or feature is sent
- **THEN** the system SHALL use a ticket type the registered app is permitted to use

#### Scenario: Not configured
- **WHEN** no ticket-system credentials are configured
- **THEN** the system SHALL store the report, skip ticket creation, and confirm receipt

### Requirement: Incoming events are authenticated
The system SHALL expose an endpoint for ticket-system events and SHALL apply an event only when its signature verifies as a keyed hash over the unmodified request body.

#### Scenario: Valid signature
- **WHEN** an event arrives whose signature matches the shared secret over the raw body
- **THEN** the system SHALL process the event

#### Scenario: Invalid or missing signature
- **WHEN** an event arrives with no signature, a malformed one, or one that does not match
- **THEN** the system SHALL reject the request and change nothing

#### Scenario: Body altered in transit
- **WHEN** the request body differs from the bytes the signature was computed over
- **THEN** the signature check SHALL fail

#### Scenario: Webhook secret not configured
- **WHEN** no shared secret is configured
- **THEN** the system SHALL reject every event rather than accept unverified ones

### Requirement: An event is applied at most once and never out of order
The system SHALL discard an event it has already applied, and SHALL discard an event that is older than the last event of its kind applied to the same report.

#### Scenario: Repeated delivery
- **WHEN** an event arrives whose event identifier has already been applied
- **THEN** the system SHALL change nothing and answer success so the sender stops retrying

#### Scenario: Out-of-order delivery
- **WHEN** an event arrives whose occurrence time is not newer than the last applied event of that kind for that report
- **THEN** the system SHALL change nothing

#### Scenario: Occurrence time missing or unreadable
- **WHEN** an event carries no usable occurrence time
- **THEN** ordering SHALL not decide the outcome, and the event identifier alone SHALL determine whether it is applied

#### Scenario: Status and replies are ordered independently
- **WHEN** a status event and a reply event arrive for the same report
- **THEN** each SHALL be compared only against the last applied event of its own kind

#### Scenario: Unknown ticket
- **WHEN** an event names a ticket that matches no stored report
- **THEN** the system SHALL change nothing and answer success

#### Scenario: Malformed event
- **WHEN** an authenticated event is missing its ticket reference or its type
- **THEN** the system SHALL reject it as a bad request

### Requirement: Status and replies reach the reporter
The system SHALL record a ticket's status changes and the replies written by handlers, and SHALL show them to the reporter.

#### Scenario: Status change recorded
- **WHEN** an admissible status event arrives
- **THEN** the system SHALL store the mapped status against the report

#### Scenario: Unknown status value
- **WHEN** a status event carries a value the system does not recognise
- **THEN** the system SHALL reject the event rather than store an unknown state

#### Scenario: Waiting for the reporter is distinct
- **WHEN** a ticket is waiting for an answer from the reporter
- **THEN** the system SHALL show that distinctly, and SHALL NOT present it as merely acknowledged

#### Scenario: Reply recorded
- **WHEN** an admissible reply event arrives
- **THEN** the system SHALL store the reply text against the report

#### Scenario: Reporter sees their own reports
- **WHEN** a user opens their report list
- **THEN** the system SHALL show each of their reports with its title, its type, its status and the latest reply, and SHALL show no other user's reports

#### Scenario: No reply yet
- **WHEN** a report has received no reply
- **THEN** the system SHALL present it as awaiting an answer rather than as answered

### Requirement: Missed events are reconciled
The system SHALL periodically bring reports up to date whose events never arrived, using the stored ticket token, and SHALL create tickets for stored reports that have none.

#### Scenario: Report left stale
- **WHEN** a report is not in a final state and no event has been applied to it for longer than the sender's retry window
- **THEN** the system SHALL read the ticket's current state and apply it

#### Scenario: Report without a ticket
- **WHEN** a stored report has no ticket reference
- **THEN** the reconciliation pass SHALL attempt to create its ticket

#### Scenario: Reconciliation applies the same rules
- **WHEN** reconciliation reads a state older than what the report already holds
- **THEN** the system SHALL discard it, exactly as it would an out-of-order event

#### Scenario: Final states are left alone
- **WHEN** a report has reached a final state
- **THEN** reconciliation SHALL skip it

#### Scenario: Ticket no longer readable
- **WHEN** a ticket cannot be read with its stored token
- **THEN** the system SHALL log it and leave the report unchanged
