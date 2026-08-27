## ADDED Requirements

### Requirement: Per-booking reply address
The system SHALL assign a booking its own reply address when it sends the initial email invitation, formed from an unguessable random token on the configured inbound mail domain, and SHALL store the complete address on the booking.

#### Scenario: Address assigned with the initial invitation
- **WHEN** a booking is created, the host's calendar source uses email invitations, and an inbound mail domain is configured
- **THEN** the system SHALL generate a random token, store the resulting address on the booking, and use it for that invitation

#### Scenario: Token is generated before the booking is persisted
- **WHEN** the invitation is prepared
- **THEN** the token SHALL be generated before the calendar message is built and SHALL be written as part of creating the booking record

#### Scenario: Address is never re-derived from configuration
- **WHEN** a booking already has a stored reply address
- **THEN** the system SHALL use that stored address, regardless of the currently configured inbound mail domain

#### Scenario: Configuration changes do not affect existing bookings
- **WHEN** the inbound mail domain is changed or removed after invitations have been sent
- **THEN** bookings that already have a stored reply address SHALL continue to use it

#### Scenario: Token is not derived from any address
- **WHEN** a reply address is generated
- **THEN** the token SHALL NOT be computable from the host's address, the guest's address, or the booking identifier

#### Scenario: Token strength and form
- **WHEN** a token is generated
- **THEN** it SHALL carry at least 128 bits of entropy from a cryptographic random source and SHALL consist only of characters valid in an email local part

#### Scenario: Tokens are unique
- **WHEN** a token is generated that already exists
- **THEN** the system SHALL generate a different one rather than reuse it

### Requirement: Sender identity is fixed for a booking's whole life
The system SHALL send every message about a booking from the same address it used for that booking's initial invitation.

#### Scenario: Booking predating the reply address
- **WHEN** a reschedule or cancellation is sent for a booking that has no stored reply address
- **THEN** the system SHALL use the default sender as both `From` and ORGANIZER, and SHALL NOT generate a reply address for it

#### Scenario: Follow-up messages reuse the stored address
- **WHEN** a booking with a stored reply address is rescheduled or cancelled
- **THEN** the follow-up message SHALL use that same address as `From` and ORGANIZER

#### Scenario: Inbound domain not configured
- **WHEN** a new booking's invitation is sent and no inbound mail domain is configured
- **THEN** the system SHALL use the default sender, store no reply address, and send the invitation anyway

### Requirement: Invitations are sent from the reply address
The system SHALL use a booking's reply address as both the `From` header of its emails and the ICS `ORGANIZER` property, so that calendar clients direct their responses to an address the system receives.

#### Scenario: Header and ORGANIZER agree
- **WHEN** an invitation, reschedule or cancellation is sent for a booking with a stored reply address
- **THEN** the `From` header and the ICS `ORGANIZER` SHALL both be that address

#### Scenario: Host name remains visible
- **WHEN** a message is sent from a reply address
- **THEN** the ORGANIZER SHALL carry the host's display name in a `CN` parameter and the `From` header SHALL carry it as a display name

#### Scenario: Bounces are directed away from the reply address
- **WHEN** a message is sent from a reply address
- **THEN** its return path SHALL be an address other than the reply address

#### Scenario: Other emails are unaffected
- **WHEN** the system sends any email that is not about a booking
- **THEN** it SHALL use the default sender address

### Requirement: Inbound replies are received over an authenticated webhook
The system SHALL expose an endpoint that accepts inbound email delivered by the mail provider and SHALL reject any request whose authenticity it cannot verify.

#### Scenario: Authenticated delivery
- **WHEN** the provider delivers a message whose signature verifies against the unmodified request body
- **THEN** the system SHALL accept the request and process the message

#### Scenario: Unauthenticated delivery
- **WHEN** a request arrives without a verifiable signature
- **THEN** the system SHALL reject it and SHALL NOT record or forward anything

#### Scenario: Repeated delivery of the same message
- **WHEN** the provider delivers a message the system has already processed
- **THEN** the system SHALL answer success without recording or forwarding it a second time

#### Scenario: Oversized delivery
- **WHEN** a delivery exceeds the endpoint's size limit
- **THEN** the system SHALL reject it with an error rather than processing a truncated message

### Requirement: A message is bound to one booking and one event version
The system SHALL identify the booking a message belongs to solely from the token in the recipient address, and SHALL discard any calendar message that does not concern that booking's current event.

#### Scenario: Recipient token selects the booking
- **WHEN** a message's body names a different booking or attendee than the recipient token implies
- **THEN** the system SHALL treat the message as belonging to the booking that owns the recipient token

#### Scenario: Calendar UID must match
- **WHEN** a calendar reply's UID differs from the booking's stored UID
- **THEN** the system SHALL discard the message without recording anything

#### Scenario: Reply to a superseded version
- **WHEN** a reply's sequence is lower than the booking's current sequence
- **THEN** the system SHALL discard it without changing the stored status

#### Scenario: Unknown token
- **WHEN** a message arrives for a token that matches no booking
- **THEN** the system SHALL discard it without recording or forwarding anything

#### Scenario: Cancelled booking
- **WHEN** a message arrives for a booking that is cancelled
- **THEN** the system SHALL discard it without recording or forwarding anything

#### Scenario: Long-past booking
- **WHEN** a message arrives for a booking whose end time is more than 30 days in the past
- **THEN** the system SHALL discard it without recording or forwarding anything

### Requirement: The replying attendee must match the authenticated sender
The system SHALL record a participation status only when the responding attendee named in the calendar message matches the authenticated sender of the mail and is an attendee of the addressed booking.

#### Scenario: Attendee matches the sender
- **WHEN** a reply names the guest as responding and the authenticated sender is the guest's address
- **THEN** the system SHALL record the status

#### Scenario: Attendee does not match the sender
- **WHEN** a reply names one attendee as responding while the authenticated sender is a different address
- **THEN** the system SHALL NOT record any status and SHALL log the mismatch

#### Scenario: Sender is not an attendee
- **WHEN** the authenticated sender is neither the booking's guest nor its stored host address
- **THEN** the system SHALL NOT record any status

#### Scenario: Sender authentication unavailable
- **WHEN** the provider reports no trustworthy authenticated sender for a message
- **THEN** the system SHALL NOT record any status

### Requirement: Participation status is recorded from iTIP replies
The system SHALL read `METHOD:REPLY` calendar messages and record the responding attendee's participation status together with the sequence it answers and the time the system received it.

#### Scenario: Guest accepts
- **WHEN** an admissible reply carries `PARTSTAT=ACCEPTED` for the guest
- **THEN** the system SHALL record the guest as having accepted, with the answered sequence and the receipt time

#### Scenario: Guest declines
- **WHEN** an admissible reply carries `PARTSTAT=DECLINED`
- **THEN** the system SHALL record the guest as having declined

#### Scenario: Tentative response
- **WHEN** an admissible reply carries `PARTSTAT=TENTATIVE`
- **THEN** the system SHALL record the response as tentative

#### Scenario: Host responds
- **WHEN** the responding attendee is the booking's stored host address
- **THEN** the system SHALL record that status against the host, separately from the guest's

#### Scenario: A later reply supersedes an earlier one
- **WHEN** an attendee replies again for the same booking and event version
- **THEN** the system SHALL replace the stored status, deciding precedence by the time the system received each message

#### Scenario: Replayed older reply
- **WHEN** a reply arrives whose timestamp is not newer than the stored one for that attendee
- **THEN** the system SHALL discard it without changing the stored status

#### Scenario: Stored status is behind the current version
- **WHEN** a booking is rescheduled after an attendee responded
- **THEN** the system SHALL report that attendee's response as outstanding until they respond to the new version

#### Scenario: Calendar method other than REPLY
- **WHEN** an admissible calendar message carries a method other than `REPLY`
- **THEN** the system SHALL discard it without recording anything

#### Scenario: Calendar part not available inline
- **WHEN** a message's calendar part is offered only as a link rather than inline
- **THEN** the system SHALL discard the message rather than retrieve the link

#### Scenario: Unparseable message
- **WHEN** an authenticated message contains no readable calendar part and no forwardable content
- **THEN** the system SHALL log it, discard it, and answer success so the provider does not retry

### Requirement: Non-calendar mail from a participant is forwarded to the host
The system SHALL forward inbound mail that is not a usable calendar reply to the host address stored on the addressed booking, when the authenticated sender is a participant of that booking.

#### Scenario: Guest replies in prose
- **WHEN** an authenticated message from the booking's guest carries no usable calendar reply
- **THEN** the system SHALL forward it to the host address stored on that booking

#### Scenario: Destination is never taken from the message
- **WHEN** a message is forwarded
- **THEN** the destination SHALL be the host address stored on the booking and SHALL NOT be any address read out of the message

#### Scenario: Sender is not a participant
- **WHEN** an authenticated message comes from an address that is neither the booking's guest nor its host
- **THEN** the system SHALL discard it without forwarding

#### Scenario: Forwarding failure
- **WHEN** forwarding fails
- **THEN** the system SHALL log the failure and answer the provider with success

### Requirement: A recorded response never changes the booking itself
Participation status SHALL be additional information about a booking and SHALL NOT alter its confirmed or cancelled state, its time, or the host's calendar entry.

#### Scenario: Decline leaves the booking standing
- **WHEN** a guest declines an invitation
- **THEN** the booking SHALL remain confirmed and the host's calendar event SHALL remain unchanged

#### Scenario: No reply at all
- **WHEN** no reply ever arrives for a booking
- **THEN** the booking SHALL behave exactly as it does today, with the response reported as outstanding
