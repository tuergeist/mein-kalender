## ADDED Requirements

### Requirement: Sidebar navigation
The app SHALL display a sidebar with navigation links to: Calendar, Bookings, Cal Sync, Settings. The active section SHALL be visually highlighted.

#### Scenario: Desktop view
- **WHEN** the viewport is desktop-sized (md and up)
- **THEN** the sidebar SHALL be permanently visible and the burger menu button SHALL be hidden

#### Scenario: Mobile view
- **WHEN** the viewport is mobile-sized (below md)
- **THEN** the sidebar SHALL be hidden by default and togglable via the burger menu button

#### Scenario: Active section highlight
- **WHEN** the user is on the `/bookings` page
- **THEN** the "Bookings" nav link SHALL be visually highlighted as active

### Requirement: Calendar page with contextual sidebar
The Calendar page SHALL show the calendar list (source entries with visibility toggles) below the navigation links in the sidebar.

#### Scenario: Calendar sidebar content
- **WHEN** the user navigates to `/calendar`
- **THEN** the sidebar SHALL show nav links at the top and the calendar entry list with toggles below

#### Scenario: Edit button on calendar page
- **WHEN** the user is on the calendar page
- **THEN** there SHALL be an edit/settings button that navigates to calendar source management

### Requirement: Bookings page with edit access
The Bookings page SHALL list upcoming and past bookings with an edit/settings button linking to booking configuration.

#### Scenario: Edit button on bookings page
- **WHEN** the user is on the bookings page
- **THEN** there SHALL be an edit/settings button linking to `/settings/booking`

### Requirement: Cal Sync page
A new `/sync` page SHALL contain the full target calendar sync configuration: target calendar selector, sync period, filter toggles, source calendar selection, save button, and cleanup section.

#### Scenario: Navigate to sync page
- **WHEN** the user clicks "Cal Sync" in the sidebar
- **THEN** the system SHALL show the target sync configuration at `/sync`

### Requirement: Slimmed settings page
The settings page SHALL contain only: map provider selector and a link to booking settings. Target sync configuration SHALL NOT appear on the settings page.

#### Scenario: Settings page content
- **WHEN** the user navigates to `/settings`
- **THEN** the page SHALL show map provider and booking settings link only, with no target sync section

### Requirement: Clean top nav
The top nav SHALL contain only: logo (links to `/calendar`), admin link (if admin), and avatar dropdown. Bookings and Settings text links SHALL be removed from the header.

#### Scenario: Header content
- **WHEN** the app is loaded
- **THEN** the header SHALL show logo, optional admin link, and avatar dropdown only
