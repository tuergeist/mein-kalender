## ADDED Requirements

### Requirement: Admin users list API
The system SHALL provide a `GET /api/admin/users` endpoint that returns a paginated, searchable list of users with their connected calendar source count and login providers.

#### Scenario: List users with defaults
- **WHEN** an admin calls `GET /api/admin/users`
- **THEN** the response contains the first 20 users sorted by `createdAt` descending
- **AND** each user includes `id`, `email`, `displayName`, `role`, `createdAt`, `calendarSourceCount`, and `providers` (list of Account provider strings)

#### Scenario: Search users by email or name
- **WHEN** an admin calls `GET /api/admin/users?search=alice`
- **THEN** the response contains only users whose `email` or `displayName` contains "alice" (case-insensitive)

#### Scenario: Paginate results
- **WHEN** an admin calls `GET /api/admin/users?page=2&limit=10`
- **THEN** the response contains users 11–20 and includes `total` count for pagination

#### Scenario: Non-admin user denied
- **WHEN** a user with `role !== "admin"` calls `GET /api/admin/users`
- **THEN** the system returns HTTP 403

### Requirement: Admin users page
The system SHALL provide a page at `/admin` that displays a searchable table of all users.

#### Scenario: Users table displays
- **WHEN** an admin navigates to `/admin`
- **THEN** a table is shown with columns: Email, Name, Providers, Calendars, Joined
- **AND** each row shows the user's login providers (e.g., "google", "credentials") and connected calendar source count

#### Scenario: Search filters the table
- **WHEN** the admin types into the search field
- **THEN** the table filters to users matching the search term
