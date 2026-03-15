## ADDED Requirements

### Requirement: Admin role in JWT
The system SHALL include the user's `role` field in the JWT claims so the backend can authorize admin requests without a database lookup.

#### Scenario: Role included in JWT on login
- **WHEN** a user logs in (credentials or OAuth)
- **THEN** the issued JWT contains a `role` claim matching the user's `role` field from the database

#### Scenario: Backend reads role from token
- **WHEN** the backend authenticates a request
- **THEN** the `AuthUser` object includes the `role` field extracted from the JWT

### Requirement: Admin route protection
The system SHALL protect all `/api/admin/*` routes with a `requireAdmin` middleware that checks `user.role === "admin"`.

#### Scenario: Admin user granted access
- **WHEN** a request with `role: "admin"` in the JWT hits an admin endpoint
- **THEN** the request proceeds normally

#### Scenario: Non-admin user denied
- **WHEN** a request with `role: "user"` in the JWT hits an admin endpoint
- **THEN** the system returns HTTP 403 with `{ error: "Forbidden" }`

#### Scenario: Unauthenticated request denied
- **WHEN** a request without a valid JWT hits an admin endpoint
- **THEN** the system returns HTTP 401

### Requirement: Admin user seeding
The system SHALL create an admin user on backend startup if one does not already exist.

#### Scenario: Admin user created on first startup
- **WHEN** the backend starts and no user with email `admin` exists
- **THEN** a user is created with email `admin`, password `adminpass123`, and role `admin`

#### Scenario: Admin user already exists
- **WHEN** the backend starts and a user with email `admin` already exists
- **THEN** no changes are made to the existing user

### Requirement: Admin frontend route protection
The system SHALL redirect non-admin users away from `/admin` pages.

#### Scenario: Non-admin user redirected
- **WHEN** a non-admin user navigates to `/admin` or `/admin/sync`
- **THEN** the user is redirected to `/`

#### Scenario: Admin user sees admin pages
- **WHEN** an admin user navigates to `/admin`
- **THEN** the admin page renders normally
