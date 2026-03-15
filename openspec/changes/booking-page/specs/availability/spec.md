## ADDED Requirements

### Requirement: Working hours configuration
The system SHALL allow users to configure their available hours per day of week. Each day has a start time, end time, and enabled flag. Default: Mon-Fri 09:00-17:00, Sat-Sun disabled.

#### Scenario: Set working hours
- **WHEN** a user sets Monday availability to 10:00-16:00
- **THEN** the system SHALL only offer booking slots within 10:00-16:00 on Mondays

#### Scenario: Disable a day
- **WHEN** a user disables Friday
- **THEN** the system SHALL offer no slots on any Friday

#### Scenario: Default availability for new users
- **WHEN** a user has no availability rules configured
- **THEN** the system SHALL use Mon-Fri 09:00-17:00 as defaults

### Requirement: Calendar-based busy detection
The system SHALL compute availability by subtracting busy calendar events from the working hours window.

#### Scenario: Event blocks a slot
- **WHEN** a user has a calendar event from 14:00-15:00 on a Tuesday
- **THEN** slots overlapping 14:00-15:00 SHALL NOT be available for booking on that Tuesday

#### Scenario: Free/transparent events don't block
- **WHEN** a calendar event has `showAs: "free"` or `transparency: "transparent"`
- **THEN** that event SHALL NOT block any booking slots

#### Scenario: Existing bookings block slots
- **WHEN** a confirmed booking exists from 11:00-11:30
- **THEN** slots overlapping 11:00-11:30 SHALL NOT be available

### Requirement: Slot generation
The system SHALL divide available time into slots based on the event type's duration.

#### Scenario: 30-minute slots in a free window
- **WHEN** working hours are 09:00-12:00 with no events, and event type duration is 30 minutes
- **THEN** the system SHALL return slots at 09:00, 09:30, 10:00, 10:30, 11:00, 11:30

#### Scenario: Partial slot at end of window
- **WHEN** the last free window is 11:00-11:45 and event type duration is 30 minutes
- **THEN** the system SHALL return a slot at 11:00 only (11:30 would extend past 11:45)

#### Scenario: No slots available
- **WHEN** all working hours are blocked by events
- **THEN** the system SHALL return an empty slot list
