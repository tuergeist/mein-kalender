## MODIFIED Requirements

### Requirement: Delete target events when source events are deleted
The system SHALL delete cloned events from the target calendar when their source events are removed during sync. This applies independently per target calendar.

#### Scenario: Source event deleted via sync delta
- **WHEN** a sync delta includes a deleted event that has a TargetEventMapping
- **THEN** the system calls `deleteEvent()` on the target provider for each mapping across all targets
- **AND** the TargetEventMapping records are deleted
- **AND** the source Event record is deleted

#### Scenario: Target provider delete fails
- **WHEN** `deleteEvent()` fails on the target provider (e.g., event already removed, permission denied)
- **THEN** the error is logged
- **AND** the TargetEventMapping and source Event are still deleted locally
- **AND** sync continues with remaining events

### Requirement: Orphaned mapping cleanup
The system SHALL detect and clean up TargetEventMappings whose source events no longer exist. This runs independently per target calendar.

#### Scenario: Source event deleted outside sync flow
- **WHEN** `cloneToTarget()` runs for a specific target and finds mappings where the source event no longer exists in the database
- **THEN** the system calls `deleteEvent()` on that target's provider for each orphaned mapping
- **AND** the orphaned TargetEventMapping records are deleted

#### Scenario: Orphan delete fails on provider
- **WHEN** `deleteEvent()` fails for an orphaned mapping
- **THEN** the TargetEventMapping is deleted anyway
- **AND** the error is logged

### Requirement: Change-aware target updates
The system SHALL only update target events when the source event has changed since the last sync to that specific target.

#### Scenario: Source event unchanged since last target sync
- **WHEN** the source event's `updatedAt` is not newer than the mapping's `lastSyncedAt`
- **THEN** the system skips the target provider `updateEvent()` call

#### Scenario: Source event changed since last target sync
- **WHEN** the source event's `updatedAt` is newer than the mapping's `lastSyncedAt`
- **THEN** the system calls `updateEvent()` on the target provider using the target's `syncMode` to determine content
- **AND** sets the mapping's `lastSyncedAt` to the current time

#### Scenario: First sync after adding lastSyncedAt
- **WHEN** a mapping has no `lastSyncedAt` value (null)
- **THEN** the system treats it as needing an update

### Requirement: Duplicate mapping prevention
The system SHALL handle duplicate mapping creation attempts gracefully.

#### Scenario: Mapping already exists for source event
- **WHEN** `cloneToTarget()` tries to create a TargetEventMapping that already exists (unique constraint violation)
- **THEN** the orphaned target event is deleted from the provider
- **AND** the duplicate is skipped without crashing the sync
