## ADDED Requirements

### Requirement: Periodic sync polling
The system SHALL periodically poll each connected calendar source for changes using BullMQ scheduled jobs. Each calendar source SHALL have a configurable poll interval (default: 5 minutes).

#### Scenario: Scheduled sync job runs
- **WHEN** a poll interval elapses for a calendar source
- **THEN** the sync engine SHALL fetch event deltas from the provider adapter since the last sync token
- **THEN** the sync engine SHALL apply those deltas (creates, updates, deletes) to the local event store

#### Scenario: Custom poll interval
- **WHEN** a user configures a custom poll interval for a calendar source
- **THEN** the sync engine SHALL use that interval instead of the default

#### Scenario: Sync job failure and retry
- **WHEN** a sync job fails (network error, API rate limit)
- **THEN** BullMQ SHALL retry the job with exponential backoff (up to 3 retries)
- **THEN** after all retries are exhausted, the system SHALL mark the source as "sync error" and continue syncing other sources

### Requirement: One-way event cloning to local store
The system SHALL clone events from source calendars into the user's unified local event store. Cloned events SHALL maintain a reference to the source event (provider, calendar ID, event ID) for tracking. This local store powers the unified UI view.

#### Scenario: New event detected on source
- **WHEN** the sync engine detects a new event on a source calendar
- **THEN** it SHALL create a corresponding event in the local store with the source reference

#### Scenario: Event updated on source
- **WHEN** the sync engine detects an updated event on a source calendar
- **THEN** it SHALL update the corresponding local event with the new data

#### Scenario: Event deleted on source
- **WHEN** the sync engine detects a deleted event on a source calendar
- **THEN** it SHALL delete the corresponding local event automatically

#### Scenario: Source reference integrity
- **WHEN** a local event exists with a source reference
- **THEN** the system SHALL be able to trace it back to the exact source provider, calendar, and event ID

### Requirement: Target calendar cloning
The system SHALL allow users to designate one provider calendar (with write access) as a "target calendar." Events from all selected source calendars SHALL be physically cloned into this target calendar on the provider. The target calendar requires write access via its provider adapter.

#### Scenario: Configure target calendar
- **WHEN** a user selects a connected calendar with write access as the target
- **THEN** the system SHALL store this as the user's target calendar configuration
- **THEN** only calendars from providers with write access SHALL be selectable as targets

#### Scenario: Clone events to target calendar
- **WHEN** the sync engine detects a new event on any source calendar
- **THEN** it SHALL create a corresponding event on the target provider calendar via the adapter's `createEvent` method
- **THEN** the cloned event SHALL store a mapping (source event ID → target event ID) for tracking

#### Scenario: Update propagation to target
- **WHEN** a source event is updated
- **THEN** the sync engine SHALL update the corresponding cloned event on the target calendar

#### Scenario: Delete propagation to target
- **WHEN** a source event is deleted
- **THEN** the sync engine SHALL delete the corresponding cloned event from the target calendar

#### Scenario: Target calendar not configured
- **WHEN** a user has not configured a target calendar
- **THEN** the system SHALL only sync to the local store (unified UI view) and not clone to any provider

#### Scenario: Multiple sources to one target
- **WHEN** a user has N source calendars configured
- **THEN** events from all N sources SHALL be cloned into the single target calendar
- **THEN** cloned events on the target SHALL be distinguishable by a prefix or tag indicating the source

#### Scenario: Source is same provider as target
- **WHEN** a source calendar is on the same provider as the target calendar
- **THEN** the system SHALL still clone events (not skip them) to ensure the target has a complete unified view

### Requirement: Edit propagation to source
The system SHALL propagate event edits made in the unified UI back to the originating source calendar via the provider adapter.

#### Scenario: User edits a synced event
- **WHEN** a user edits a synced event (title, time, description) in the UI
- **THEN** the system SHALL call the source provider's `updateEvent` method to push the change
- **THEN** the local event SHALL be updated only after the source confirms the change

#### Scenario: Source rejects the edit
- **WHEN** the source provider rejects an edit (e.g., read-only calendar, permission denied)
- **THEN** the system SHALL revert the local event to its previous state and show an error to the user

### Requirement: Manual sync trigger
The system SHALL provide a "Sync Now" action that immediately triggers a sync for all of a user's connected sources or a specific source.

#### Scenario: User triggers manual sync
- **WHEN** a user clicks "Sync Now"
- **THEN** the system SHALL enqueue immediate sync jobs for all the user's connected sources
- **THEN** the UI SHALL show a syncing indicator until all jobs complete

### Requirement: Sync state tracking
The system SHALL maintain sync state per calendar source, including last sync timestamp, sync token (if provider supports incremental sync), and sync status (ok, syncing, error).

#### Scenario: Incremental sync with token
- **WHEN** a provider supports sync tokens (Google, Outlook)
- **THEN** the engine SHALL store and send the sync token to fetch only changes since the last sync

#### Scenario: Full sync fallback
- **WHEN** a sync token is invalid or expired
- **THEN** the engine SHALL perform a full sync of the calendar and obtain a new sync token

### Requirement: Concurrency control
The system SHALL prevent concurrent sync jobs for the same calendar source. BullMQ SHALL use a concurrency limiter keyed by source ID.

#### Scenario: Overlapping sync prevented
- **WHEN** a sync job is already running for a calendar source
- **THEN** a new sync job for the same source SHALL be queued and wait for the running job to finish
