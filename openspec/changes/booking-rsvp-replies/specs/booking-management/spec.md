## ADDED Requirements

### Requirement: Booking list shows attendee responses
The system SHALL show the host, for each booking in the booking list that was sent as an email invitation, whether the guest has accepted, declined, responded tentatively, or not yet responded.

#### Scenario: Guest has responded
- **WHEN** a host views the booking list and a reply has been recorded for a booking's current version
- **THEN** the system SHALL display the guest's participation status for that booking

#### Scenario: Guest has not responded
- **WHEN** a host views a booking for which no reply has been recorded
- **THEN** the system SHALL display the response as outstanding, distinct from a decline

#### Scenario: Response predates a reschedule
- **WHEN** a booking was rescheduled after the guest responded
- **THEN** the system SHALL display the response as outstanding rather than showing the answer to the previous time

#### Scenario: Booking without email invitation
- **WHEN** a booking was written directly to the host's calendar rather than sent as an invitation
- **THEN** the system SHALL NOT display a response status for it

### Requirement: Booking shows whether the invitation reached the host
The system SHALL show the host their own participation status for a booking sent as an email invitation, because a missing host response is the evidence that the invitation never arrived in the host's calendar.

#### Scenario: Host has responded
- **WHEN** the host has accepted or declined the invitation in their own calendar
- **THEN** the system SHALL display that status alongside the guest's

#### Scenario: Host has not responded
- **WHEN** no host response has been recorded for a booking whose start time has passed
- **THEN** the system SHALL indicate that the invitation may not have reached the host's calendar
