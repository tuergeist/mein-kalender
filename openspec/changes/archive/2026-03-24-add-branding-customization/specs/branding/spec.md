## ADDED Requirements

### Requirement: User branding settings storage
The system SHALL store per-user branding configuration: brand color (hex), accent color (hex), and background image URL. All fields are optional and default to the system's built-in styling when unset.

#### Scenario: No branding configured
- **WHEN** a user has not set any branding fields
- **THEN** the system SHALL use default styling (blue primary, gray background, no profile photo displayed)

#### Scenario: Partial branding configured
- **WHEN** a user sets only `brandColor` but leaves other fields unset
- **THEN** the system SHALL apply the brand color and use defaults for all other branding properties

### Requirement: Branding settings API
The system SHALL allow authenticated users to update their branding settings via `PUT /api/profile/branding`.

#### Scenario: Update brand color
- **WHEN** a user sends `{ "brandColor": "#e11d48" }` to `PUT /api/profile/branding`
- **THEN** the system SHALL save the color and return the updated branding object

#### Scenario: Clear branding field
- **WHEN** a user sends `{ "brandColor": null }` to `PUT /api/profile/branding`
- **THEN** the system SHALL clear the brand color and revert to the default

#### Scenario: Invalid color format
- **WHEN** a user sends `{ "brandColor": "not-a-color" }`
- **THEN** the system SHALL return a 400 error

### Requirement: Branding settings UI
The system SHALL provide a branding configuration section in the booking settings page with color pickers for brand and accent colors, and URL inputs for profile photo and background image.

#### Scenario: User sets brand color via color picker
- **WHEN** a user picks a color in the brand color picker and saves
- **THEN** the branding SHALL be persisted and reflected on their booking pages

#### Scenario: User sets profile photo URL
- **WHEN** a user enters a URL in the profile photo field and saves
- **THEN** their booking pages SHALL display the photo

#### Scenario: User sets background image URL
- **WHEN** a user enters a URL in the background image field and saves
- **THEN** their booking pages SHALL use it as the page background

### Requirement: Public branding data
The public booking API SHALL return the host's branding data so booking pages can render it without authentication.

#### Scenario: Public endpoint returns branding
- **WHEN** a visitor loads a booking page for a user with branding configured
- **THEN** the API response SHALL include a `branding` object with `brandColor`, `accentColor`, `avatarUrl`, and `backgroundUrl`

#### Scenario: Public endpoint with no branding
- **WHEN** a visitor loads a booking page for a user with no branding configured
- **THEN** the API response SHALL include a `branding` object with all fields set to `null`
