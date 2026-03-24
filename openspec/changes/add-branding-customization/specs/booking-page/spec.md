## MODIFIED Requirements

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
