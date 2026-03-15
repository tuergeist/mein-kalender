## ADDED Requirements

### Requirement: Proton setup page with guided instructions
The system SHALL provide a setup page at `/settings/proton` that guides users through sharing their Proton Calendar via link and subscribing to the ICS URL.

#### Scenario: Page displays setup instructions
- **WHEN** user navigates to `/settings/proton`
- **THEN** the page displays step-by-step instructions for getting a Proton Calendar share link
- **AND** the instructions cover: open Proton Calendar → select calendar → Settings → Share → "Share with anyone" → copy link
- **AND** an input field for the ICS URL is displayed
- **AND** an optional label input is displayed

#### Scenario: Back navigation to settings
- **WHEN** user clicks the back button
- **THEN** the user is navigated to `/settings`

### Requirement: Subscribe to Proton Calendar ICS link
The system SHALL subscribe to a Proton Calendar ICS share link using the existing ICS subscription backend.

#### Scenario: Successful subscription
- **WHEN** user pastes a valid Proton Calendar share URL and submits
- **THEN** the system calls `POST /api/ics/subscribe` with the URL and label
- **AND** events are imported and a CalendarSource is created with `provider: "ics"`
- **AND** the user is redirected to `/settings` with a success indication

#### Scenario: Invalid or unreachable URL
- **WHEN** user submits a URL that is unreachable or does not return valid ICS data
- **THEN** an error message is displayed on the page
- **AND** no CalendarSource is created

#### Scenario: Empty URL submission
- **WHEN** user clicks submit without entering a URL
- **THEN** the submit button is disabled or an error is shown

### Requirement: Remove unused CalDAV Proton provider
The system SHALL remove the CalDAV-based `ProtonCalendarProvider` and its associated type enum since Proton does not support external CalDAV access without Bridge.

#### Scenario: Provider cleanup
- **WHEN** the change is applied
- **THEN** `packages/backend/src/providers/proton.ts` is deleted
- **AND** the `PROTON` value is removed from the `Provider` enum in `types.ts`
- **AND** the Proton case is removed from `getProvider()` in `providers/index.ts`
