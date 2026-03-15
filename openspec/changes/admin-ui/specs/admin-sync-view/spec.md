## ADDED Requirements

### Requirement: Admin sync queue API
The system SHALL provide a `GET /api/admin/sync` endpoint that returns BullMQ job counts and recent jobs.

#### Scenario: Return job counts and recent jobs
- **WHEN** an admin calls `GET /api/admin/sync`
- **THEN** the response contains `counts` with `active`, `waiting`, `completed`, and `failed` totals
- **AND** the response contains `jobs` — the 50 most recent jobs across all states, sorted by timestamp descending
- **AND** each job includes `id`, `name`, `state`, `data` (sourceId, userId), `timestamp`, `finishedOn`, `failedReason`, and `attemptsMade`

#### Scenario: Non-admin user denied
- **WHEN** a user with `role !== "admin"` calls `GET /api/admin/sync`
- **THEN** the system returns HTTP 403

### Requirement: Admin sync queue page
The system SHALL provide a page at `/admin/sync` that displays the sync queue status and recent jobs.

#### Scenario: Job counts summary displays
- **WHEN** an admin navigates to `/admin/sync`
- **THEN** summary cards are shown for active, waiting, completed, and failed job counts

#### Scenario: Recent jobs table displays
- **WHEN** an admin navigates to `/admin/sync`
- **THEN** a table of recent jobs is shown with columns: Source ID, State, Started, Finished, Error, Attempts

#### Scenario: Failed jobs show error details
- **WHEN** a job has `failedReason` set
- **THEN** the error message is displayed in the Error column
