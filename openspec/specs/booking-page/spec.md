## ADDED Requirements

### Requirement: Public booking page
The system SHALL serve a public page at `/book/<username>/<slug>` that does not require authentication. The page SHALL apply the host's branding (colors, profile photo, background) when configured.

#### Scenario: Valid booking page
- **WHEN** a visitor navigates to `/book/johndoe/30-min-call`
- **THEN** the page SHALL display the event type info (name, duration, description, location) and a date picker

#### Scenario: Invalid username or slug
- **WHEN** a visitor navigates to a booking page with a non-existent username or slug
- **THEN** the page SHALL display a "not found" message

#### Scenario: Disabled event type
- **WHEN** a visitor navigates to a booking page for a disabled event type
- **THEN** the page SHALL display a "this event type is currently not available" message

#### Scenario: Booking page with brand colors
- **WHEN** a visitor loads a booking page and the host has `brandColor` set
- **THEN** buttons, selected date highlights, and interactive accents SHALL use the host's brand color instead of the default blue

#### Scenario: Booking page with profile photo
- **WHEN** a visitor loads a booking page and the host has `avatarUrl` set
- **THEN** the page SHALL display the host's profile photo next to their display name

#### Scenario: Booking page with broken profile photo
- **WHEN** a visitor loads a booking page and the host's `avatarUrl` fails to load
- **THEN** the page SHALL hide the broken image and show only the display name

#### Scenario: Booking page with background image
- **WHEN** a visitor loads a booking page and the host has `backgroundUrl` set
- **THEN** the page background SHALL display the image with appropriate covering/dimming so text remains readable

#### Scenario: Booking page with no branding
- **WHEN** a visitor loads a booking page and the host has no branding configured
- **THEN** the page SHALL render with default styling identical to the current appearance

### Requirement: Date picker shows available days
The booking page SHALL display a monthly calendar where days with at least one available slot are selectable, and days with no slots are grayed out.

#### Scenario: Select a date with availability
- **WHEN** a visitor clicks on a date that has available slots
- **THEN** the system SHALL display the list of available time slots for that date

#### Scenario: Date in the past
- **WHEN** a date is in the past
- **THEN** it SHALL be grayed out and not selectable

### Requirement: Time slot selection
After selecting a date, the visitor SHALL see a list of available time slots. Selecting a slot opens the booking form.

#### Scenario: Select a time slot
- **WHEN** a visitor selects the 14:00 slot
- **THEN** the system SHALL show the booking form with the selected date and time pre-filled

### Requirement: Booking form
The booking form SHALL collect: guest name (required), guest email (required), and optional notes.

#### Scenario: Submit valid booking
- **WHEN** a visitor fills in name, email, and submits the form
- **THEN** the system SHALL create a booking, create an event on the host's calendar, and show a confirmation

#### Scenario: Submit with missing required fields
- **WHEN** a visitor submits without name or email
- **THEN** the form SHALL show validation errors

#### Scenario: Slot no longer available
- **WHEN** a visitor tries to book a slot that became unavailable since the page loaded
- **THEN** the system SHALL return an error and prompt the visitor to pick a different slot

### Requirement: Username configuration
The system SHALL allow users to set a username for their public booking URL.

#### Scenario: Set username
- **WHEN** a user sets their username to "johndoe"
- **THEN** their booking pages SHALL be accessible at `/book/johndoe/*`

#### Scenario: Username taken
- **WHEN** a user tries to set a username already taken by another user
- **THEN** the system SHALL return an error

#### Scenario: Username format
- **WHEN** a user sets a username
- **THEN** it SHALL only contain lowercase letters, numbers, and hyphens
