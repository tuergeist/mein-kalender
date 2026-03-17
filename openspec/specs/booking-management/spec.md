## ADDED Requirements

### Requirement: List bookings
The system SHALL allow authenticated users to view their upcoming and past bookings.

#### Scenario: View upcoming bookings
- **WHEN** a user navigates to the bookings page
- **THEN** the system SHALL display all confirmed future bookings ordered by start time

#### Scenario: No bookings
- **WHEN** a user has no bookings
- **THEN** the system SHALL display an empty state message

### Requirement: Cancel booking
The system SHALL allow the host to cancel a confirmed booking.

#### Scenario: Cancel a future booking
- **WHEN** a host cancels a confirmed booking
- **THEN** the system SHALL mark the booking as cancelled and delete the corresponding event from the host's calendar

#### Scenario: Cancel a past booking
- **WHEN** a host tries to cancel a booking that has already passed
- **THEN** the system SHALL still allow cancellation (marks as cancelled, no calendar deletion needed)

### Requirement: Booking creates calendar event
When a booking is confirmed, the system SHALL create an event on the host's writable calendar.

#### Scenario: Booking with target calendar
- **WHEN** a booking is confirmed and the host has a target calendar configured
- **THEN** the system SHALL create an event titled "[Booking] Guest Name — Event Type" on the target calendar

#### Scenario: Booking without target calendar
- **WHEN** a booking is confirmed and no target calendar is set
- **THEN** the system SHALL create the event on the first writable calendar the host has connected

#### Scenario: Event details
- **WHEN** a booking event is created
- **THEN** it SHALL include the guest's name, email, and any notes in the event description
