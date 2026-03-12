## ADDED Requirements

### Requirement: Docker containerization
The system SHALL provide Dockerfiles for each deployable component: `web` (Next.js frontend), `api` (Fastify backend), and `sync-worker` (BullMQ processor). Each image SHALL be production-optimized (multi-stage build, minimal base image).

#### Scenario: Build web container
- **WHEN** `docker build` is run for the web package
- **THEN** it SHALL produce a container running the Next.js application on port 3000

#### Scenario: Build API container
- **WHEN** `docker build` is run for the api package
- **THEN** it SHALL produce a container running the Fastify server on a configurable port (default 4000)

#### Scenario: Build sync-worker container
- **WHEN** `docker build` is run for the sync-worker package
- **THEN** it SHALL produce a container running the BullMQ worker process

#### Scenario: Multi-stage builds
- **WHEN** any Dockerfile is built
- **THEN** it SHALL use multi-stage builds to exclude dev dependencies and source maps from the production image

### Requirement: Kubernetes manifests
The system SHALL provide Kubernetes manifests (or Helm chart) for deploying all components: web, api, sync-worker, PostgreSQL, and Redis.

#### Scenario: Deploy to k8s cluster
- **WHEN** manifests are applied to a Kubernetes cluster
- **THEN** all components SHALL be deployed with appropriate resource requests/limits

#### Scenario: Service discovery
- **WHEN** components are deployed
- **THEN** the web container SHALL be able to reach the api via a Kubernetes Service
- **THEN** the api and sync-worker SHALL be able to reach PostgreSQL and Redis via Services

#### Scenario: Ingress configuration
- **WHEN** the web service is deployed
- **THEN** an Ingress resource SHALL route external HTTP traffic to the web service

### Requirement: Environment configuration
The system SHALL be configured via environment variables. No secrets SHALL be hardcoded. A `.env.example` file SHALL document all required variables.

#### Scenario: Required env vars documented
- **WHEN** a developer sets up the project
- **THEN** `.env.example` SHALL list all required environment variables with descriptions

#### Scenario: Missing required env var
- **WHEN** a required environment variable is not set
- **THEN** the application SHALL fail to start with a clear error message naming the missing variable

#### Scenario: Secrets management
- **WHEN** deploying to Kubernetes
- **THEN** sensitive values (DB password, OAuth secrets, encryption keys) SHALL be provided via Kubernetes Secrets, not ConfigMaps

### Requirement: Health checks
Each deployable component SHALL expose a health check endpoint.

#### Scenario: API health check
- **WHEN** a GET request is made to `/health` on the API
- **THEN** it SHALL return 200 with a JSON body indicating service status and database connectivity

#### Scenario: Kubernetes liveness/readiness probes
- **WHEN** components are deployed to Kubernetes
- **THEN** liveness and readiness probes SHALL be configured using the health check endpoints

### Requirement: Local development setup
The system SHALL provide a `docker-compose.yml` for local development that starts all dependencies (PostgreSQL, Redis) and supports hot-reload for the application code.

#### Scenario: Start local environment
- **WHEN** a developer runs `docker compose up`
- **THEN** PostgreSQL and Redis SHALL start and be accessible to the application
- **THEN** the developer SHALL be able to run `web`, `api`, and `sync-worker` locally with hot-reload against these services
