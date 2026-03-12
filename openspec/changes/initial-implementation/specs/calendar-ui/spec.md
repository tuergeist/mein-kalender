## ADDED Requirements

### Requirement: Unified calendar view
The system SHALL display a unified calendar view aggregating events from all connected calendar sources. The view SHALL use FullCalendar with HeroUI components for surrounding UI elements (toolbar, sidebars, modals).

#### Scenario: Calendar renders all sources
- **WHEN** a user opens the calendar view
- **THEN** the system SHALL display events from all connected and enabled calendar sources in a single view
- **THEN** events SHALL be color-coded by source calendar

#### Scenario: Calendar view modes
- **WHEN** a user switches between day, week, and month views
- **THEN** the calendar SHALL re-render in the selected mode preserving the current date context

#### Scenario: Navigate dates
- **WHEN** a user clicks next/previous or selects a date
- **THEN** the calendar SHALL navigate to that date and load events for the visible range

### Requirement: Event display
The system SHALL display event details including title, time, duration, location, and source calendar. Events SHALL be visually distinguishable by source.

#### Scenario: Event rendered on calendar
- **WHEN** an event exists in the visible date range
- **THEN** the calendar SHALL render it with the event title, time range, and source calendar color

#### Scenario: Event detail popover
- **WHEN** a user clicks on an event in the calendar
- **THEN** the system SHALL show a popover/modal (HeroUI Modal or Popover) with full event details: title, start/end time, location, description, and source calendar name

### Requirement: Inline event editing
The system SHALL allow users to edit event details directly from the calendar UI. Edits SHALL be propagated to the source calendar.

#### Scenario: Edit event via modal
- **WHEN** a user clicks "Edit" on an event detail view
- **THEN** the system SHALL display an edit form (HeroUI Input, DatePicker, Textarea) with pre-filled event data
- **THEN** on save, the system SHALL send the update to the backend for propagation to the source

#### Scenario: Drag-and-drop reschedule
- **WHEN** a user drags an event to a different time slot on the calendar
- **THEN** the system SHALL update the event's start/end time and propagate the change to the source

#### Scenario: Read-only event cannot be edited
- **WHEN** a user views an event from a read-only source (ICS import)
- **THEN** the edit controls SHALL be disabled and a read-only indicator SHALL be shown

### Requirement: Responsive mobile layout
The system SHALL provide a responsive layout that works on mobile devices (screen width < 768px). The calendar SHALL adapt to smaller screens.

#### Scenario: Mobile calendar view
- **WHEN** the viewport width is less than 768px
- **THEN** the calendar SHALL default to a day or agenda list view instead of month view
- **THEN** navigation and toolbar elements SHALL be accessible via a mobile-friendly layout

#### Scenario: Mobile event interaction
- **WHEN** a user taps an event on mobile
- **THEN** the event detail view SHALL be displayed as a full-screen modal or bottom sheet

### Requirement: Calendar source sidebar
The system SHALL display a sidebar listing all connected calendar sources with toggles to show/hide each source's events.

#### Scenario: Toggle source visibility
- **WHEN** a user unchecks a calendar source in the sidebar
- **THEN** events from that source SHALL be hidden from the calendar view without removing them

#### Scenario: Source sync status indicator
- **WHEN** a calendar source is syncing or has a sync error
- **THEN** the sidebar SHALL show a status icon (syncing spinner, error badge) next to that source

### Requirement: Calendar source management page
The system SHALL provide a settings page where users can connect, configure, and disconnect calendar sources.

#### Scenario: Connect new source
- **WHEN** a user clicks "Add Calendar" and selects a provider (Google, Outlook, Proton)
- **THEN** the system SHALL initiate the provider's authentication flow

#### Scenario: Disconnect source
- **WHEN** a user disconnects a calendar source
- **THEN** the system SHALL revoke the OAuth token (if supported), remove stored credentials, and delete synced events from that source

#### Scenario: Configure sync settings
- **WHEN** a user opens settings for a connected source
- **THEN** the system SHALL allow configuring sync interval and selecting which calendars from that provider to sync

### Requirement: Target calendar configuration
The system SHALL provide a UI for users to designate a target calendar where events from all sources are physically cloned.

#### Scenario: Select target calendar
- **WHEN** a user opens the target calendar settings
- **THEN** the system SHALL display a list of connected calendars with write access
- **THEN** the user SHALL be able to select one as the clone target

#### Scenario: No target configured
- **WHEN** no target calendar is configured
- **THEN** the system SHALL display a prompt suggesting the user set one up, but SHALL NOT require it (the unified UI view works without a target)

#### Scenario: Change target calendar
- **WHEN** a user changes the target calendar to a different one
- **THEN** the system SHALL warn that previously cloned events on the old target will not be automatically removed
