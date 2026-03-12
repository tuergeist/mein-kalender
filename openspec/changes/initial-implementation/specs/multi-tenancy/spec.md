## ADDED Requirements

### Requirement: User sign-up
The system SHALL provide a dedicated sign-up flow where users create an account with email and password. Social login (Google, Microsoft) SHALL also be available as a sign-up method.

#### Scenario: Email/password registration
- **WHEN** a user submits the sign-up form with email and password
- **THEN** the system SHALL create a user account, hash the password, and send an email verification link
- **THEN** the user SHALL NOT be able to use the system until email is verified

#### Scenario: Social login registration
- **WHEN** a user clicks "Sign up with Google" or "Sign up with Microsoft"
- **THEN** the system SHALL create a user account linked to the social identity
- **THEN** email verification SHALL be skipped (trusted provider)

#### Scenario: Duplicate email prevention
- **WHEN** a user attempts to register with an email already in use
- **THEN** the system SHALL reject the registration and suggest logging in instead

### Requirement: User login
The system SHALL provide login via email/password and social login (Google, Microsoft).

#### Scenario: Email/password login
- **WHEN** a user submits valid email and password
- **THEN** the system SHALL create a session and redirect to the calendar view

#### Scenario: Social login
- **WHEN** a user clicks "Log in with Google" or "Log in with Microsoft"
- **THEN** the system SHALL authenticate via OAuth and create a session

#### Scenario: Failed login
- **WHEN** a user submits invalid credentials
- **THEN** the system SHALL display a generic error ("Invalid email or password") without revealing which field is wrong

### Requirement: Session management
The system SHALL manage user sessions using NextAuth.js with JWT-based sessions.

#### Scenario: Session validity
- **WHEN** a user has an active session
- **THEN** the system SHALL allow access to all authenticated endpoints

#### Scenario: Session expiry
- **WHEN** a session JWT expires
- **THEN** the system SHALL redirect the user to the login page

#### Scenario: Logout
- **WHEN** a user clicks "Log out"
- **THEN** the system SHALL invalidate the session and redirect to the login page

### Requirement: User profile
The system SHALL store a user profile with: email, display name, avatar URL (from social provider if available), and account creation date. The profile model SHALL be extensible for future fields (subscription tier, role).

#### Scenario: View profile
- **WHEN** a user navigates to their profile
- **THEN** the system SHALL display their email, display name, and avatar

#### Scenario: Update display name
- **WHEN** a user changes their display name
- **THEN** the system SHALL persist the change

### Requirement: Per-user calendar source isolation
Each user SHALL only see and manage their own connected calendar sources and synced events. No data SHALL leak between users.

#### Scenario: Data isolation enforcement
- **WHEN** a user queries calendar sources or events
- **THEN** the system SHALL filter all queries by the authenticated user's ID
- **THEN** direct access to another user's resources by ID SHALL return 404 (not 403)

#### Scenario: API authorization
- **WHEN** an unauthenticated request reaches a protected endpoint
- **THEN** the system SHALL return 401 Unauthorized

### Requirement: Password security
The system SHALL hash passwords using bcrypt with a minimum cost factor of 12. Plaintext passwords SHALL never be stored or logged.

#### Scenario: Password hashing
- **WHEN** a user creates or changes their password
- **THEN** the system SHALL hash it with bcrypt (cost >= 12) before storing

#### Scenario: Password not logged
- **WHEN** a password is submitted in a request
- **THEN** the system SHALL exclude it from all logs and error reports
