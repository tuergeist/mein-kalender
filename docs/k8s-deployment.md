# Kubernetes Deployment Guide for calendar-sync

This document covers deploying the calendar-sync platform to a Kubernetes cluster. It assumes container images are built and pushed by the GitHub Actions CI/CD pipeline to GitHub Container Registry.

## Prerequisites

- `kubectl` configured with access to your target cluster
- A Kubernetes cluster (1.27+) with:
  - An ingress controller installed (nginx-ingress)
  - cert-manager (optional, for automatic TLS certificates)
  - A default StorageClass for PersistentVolumeClaims
- Access to GitHub Container Registry images at `ghcr.io/tuergeist/mein-kalender`
- DNS control for `mein-kalender.link`

## Container Images

All images are built by CI/CD on every push to `main` and published to:

| Service     | Image                                            | Port |
|-------------|--------------------------------------------------|------|
| api         | `ghcr.io/tuergeist/mein-kalender/api:latest`         | 4200 |
| web         | `ghcr.io/tuergeist/mein-kalender/web:latest`         | 3000 |
| sync-worker | `ghcr.io/tuergeist/mein-kalender/sync-worker:latest` | N/A  |
| landing     | `ghcr.io/tuergeist/mein-kalender/landing:latest`     | 80   |

Tag formats available:
- `latest` -- latest build from `main`
- `<commit-sha>` -- pinned to a specific commit (e.g., `a1b2c3d`)
- `<semver>` -- when a Git tag like `v1.2.3` is pushed (produces `1.2.3` and `1.2`)

For production, prefer pinning to a commit SHA or semver tag rather than `latest`.

## Namespace Setup

Create a dedicated namespace (optional but recommended):

```bash
kubectl create namespace calendar-sync
```

All subsequent commands assume you either set this as default or append `-n calendar-sync`.

```bash
kubectl config set-context --current --namespace=calendar-sync
```

## Image Pull Secret (if registry is private)

If the GitHub Container Registry packages are private, create an image pull secret:

```bash
kubectl create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GITHUB_PAT \
  --docker-email=YOUR_EMAIL \
  -n calendar-sync
```

Then add `imagePullSecrets` to each deployment spec:

```yaml
spec:
  template:
    spec:
      imagePullSecrets:
        - name: ghcr-pull-secret
```

If the packages are public, skip this step.

## Step 1: Configure Secrets and ConfigMap

The file `k8s/secrets.yaml` contains both a Secret and a ConfigMap. You must edit it before applying.

### Secrets (k8s/secrets.yaml -- Secret resource)

Replace all `CHANGE_ME` placeholders with real values:

| Key                              | Description                                                         | How to Generate                                    |
|----------------------------------|---------------------------------------------------------------------|----------------------------------------------------|
| `DATABASE_URL`                   | Full PostgreSQL connection string                                   | `postgresql://calendar_sync:<password>@postgres:5432/calendar_sync` |
| `DB_PASSWORD`                    | PostgreSQL password (must match the password in DATABASE_URL)       | `openssl rand -base64 32`                          |
| `REDIS_URL`                      | Redis connection string                                             | Default: `redis://redis:6379`                      |
| `NEXTAUTH_SECRET`               | Secret for NextAuth.js session signing                              | `openssl rand -base64 32`                          |
| `ENCRYPTION_SECRET`             | 32-byte hex key for encrypting OAuth tokens at rest                 | `openssl rand -hex 32`                             |
| `GOOGLE_CLIENT_ID`              | Google OAuth client ID (for user login)                             | From Google Cloud Console                          |
| `GOOGLE_CLIENT_SECRET`          | Google OAuth client secret (for user login)                         | From Google Cloud Console                          |
| `GOOGLE_CALENDAR_CLIENT_ID`     | Google OAuth client ID (for Calendar API access)                    | From Google Cloud Console                          |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Google OAuth client secret (for Calendar API access)                | From Google Cloud Console                          |
| `MICROSOFT_CLIENT_ID`           | Microsoft OAuth client ID (for user login)                          | From Azure Portal App Registration                 |
| `MICROSOFT_CLIENT_SECRET`       | Microsoft OAuth client secret (for user login)                      | From Azure Portal App Registration                 |
| `MICROSOFT_TENANT_ID`           | Microsoft tenant ID (`common` for multi-tenant)                     | From Azure Portal                                  |
| `MICROSOFT_CALENDAR_CLIENT_ID`     | Microsoft OAuth client ID (for Calendar API access)              | From Azure Portal App Registration                 |
| `MICROSOFT_CALENDAR_CLIENT_SECRET` | Microsoft OAuth client secret (for Calendar API access)          | From Azure Portal App Registration                 |

### ConfigMap (k8s/secrets.yaml -- ConfigMap resource)

Update these values for your deployment:

| Key                 | Description                              | Production Value                               |
|---------------------|------------------------------------------|------------------------------------------------|
| `NEXTAUTH_URL`      | Public URL of the web app                | `https://app.mein-kalender.link`               |
| `API_INTERNAL_URL`  | Cluster-internal URL for the API service | `http://calendar-sync-api:4200` (keep as-is)   |
| `API_PORT`          | Port the API listens on                  | `4200` (keep as-is)                            |
| `API_HOST`          | Host the API binds to                    | `0.0.0.0` (keep as-is)                        |

Apply the secrets and config:

```bash
kubectl apply -f k8s/secrets.yaml -n calendar-sync
```

Verify:

```bash
kubectl get secret calendar-sync-secrets -n calendar-sync
kubectl get configmap calendar-sync-config -n calendar-sync
```

## Step 2: Deploy PostgreSQL

```bash
kubectl apply -f k8s/postgres.yaml -n calendar-sync
```

This creates:
- A `Deployment` running `postgres:17-alpine` with 1 replica
- A `Service` exposing port 5432 (ClusterIP, internal only)
- A `PersistentVolumeClaim` (10Gi) for data persistence

Wait for PostgreSQL to be ready:

```bash
kubectl rollout status deployment/postgres -n calendar-sync
```

Verify the database is accepting connections:

```bash
kubectl exec -it deployment/postgres -n calendar-sync -- psql -U calendar_sync -d calendar_sync -c "SELECT 1;"
```

## Step 3: Deploy Redis

```bash
kubectl apply -f k8s/redis.yaml -n calendar-sync
```

This creates:
- A `Deployment` running `redis:7-alpine` with 1 replica
- A `Service` exposing port 6379 (ClusterIP, internal only)
- A `PersistentVolumeClaim` (1Gi) for data persistence

Wait for Redis to be ready:

```bash
kubectl rollout status deployment/redis -n calendar-sync
```

## Step 4: Deploy the API

First, update the image reference in `k8s/api.yaml`:

```yaml
image: ghcr.io/tuergeist/mein-kalender/api:latest
```

Then apply:

```bash
kubectl apply -f k8s/api.yaml -n calendar-sync
```

This creates:
- A `Deployment` with 2 replicas
- A `Service` on port 4200 (ClusterIP)
- Liveness probe at `/health` (port 4200)
- Readiness probe at `/health` (port 4200)

On first startup, the API container runs `prisma db push --skip-generate` to apply the database schema. Wait for it to become ready:

```bash
kubectl rollout status deployment/calendar-sync-api -n calendar-sync
```

Check logs to confirm schema migration succeeded:

```bash
kubectl logs deployment/calendar-sync-api -n calendar-sync --tail=50
```

## Step 5: Deploy the Sync Worker

Update the image in `k8s/sync-worker.yaml`:

```yaml
image: ghcr.io/tuergeist/mein-kalender/sync-worker:latest
```

Then apply:

```bash
kubectl apply -f k8s/sync-worker.yaml -n calendar-sync
```

This creates a `Deployment` with 1 replica (no Service, since the worker only consumes from the BullMQ/Redis queue).

```bash
kubectl rollout status deployment/calendar-sync-worker -n calendar-sync
```

## Step 6: Deploy the Web Frontend

Update the image in `k8s/web.yaml`:

```yaml
image: ghcr.io/tuergeist/mein-kalender/web:latest
```

Then apply:

```bash
kubectl apply -f k8s/web.yaml -n calendar-sync
```

This creates:
- A `Deployment` with 2 replicas
- A `Service` mapping port 80 to container port 3000 (ClusterIP)
- Liveness and readiness probes on `/` (port 3000)

```bash
kubectl rollout status deployment/calendar-sync-web -n calendar-sync
```

## Step 7: Configure Ingress

Edit `k8s/ingress.yaml` to set the correct hostnames. The existing file has a single host with both web and API paths. For the production setup with `mein-kalender.link`, replace the contents with:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: calendar-sync-ingress
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.mein-kalender.link
      secretName: app-mein-kalender-tls
    - hosts:
        - mein-kalender.link
      secretName: mein-kalender-tls
  rules:
    - host: app.mein-kalender.link
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: calendar-sync-api
                port:
                  number: 4200
          - path: /
            pathType: Prefix
            backend:
              service:
                name: calendar-sync-web
                port:
                  number: 80
    - host: mein-kalender.link
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: calendar-sync-landing
                port:
                  number: 80
```

Apply:

```bash
kubectl apply -f k8s/ingress.yaml -n calendar-sync
```

### TLS with cert-manager

If you have cert-manager installed with a `ClusterIssuer` named `letsencrypt-prod`, the ingress annotations above will automatically provision TLS certificates. If you do not have cert-manager, remove the `tls` and `cert-manager.io/cluster-issuer` sections and handle TLS termination at your load balancer or CDN.

## Step 8: Deploy the Landing Page (Optional)

If you want to serve the landing page from the cluster (at `mein-kalender.link`), create a deployment and service for it:

```yaml
# k8s/landing.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: calendar-sync-landing
  labels:
    app: calendar-sync-landing
spec:
  replicas: 1
  selector:
    matchLabels:
      app: calendar-sync-landing
  template:
    metadata:
      labels:
        app: calendar-sync-landing
    spec:
      containers:
        - name: landing
          image: ghcr.io/tuergeist/mein-kalender/landing:latest
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 10m
              memory: 16Mi
            limits:
              cpu: 100m
              memory: 64Mi
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 3
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: calendar-sync-landing
spec:
  selector:
    app: calendar-sync-landing
  ports:
    - port: 80
      targetPort: 80
  type: ClusterIP
```

```bash
kubectl apply -f k8s/landing.yaml -n calendar-sync
```

## DNS Setup

Configure DNS records for your domain:

| Record Type | Name                      | Value                                 |
|-------------|---------------------------|---------------------------------------|
| A           | `mein-kalender.link`      | Your cluster's ingress load balancer IP |
| A           | `app.mein-kalender.link`  | Your cluster's ingress load balancer IP |

To find the ingress load balancer IP:

```bash
kubectl get svc -n ingress-nginx
# or
kubectl get ingress calendar-sync-ingress -n calendar-sync
```

If your load balancer provides a hostname instead of an IP (e.g., on AWS), use CNAME records instead of A records.

### DNS Propagation

After setting DNS records, verify propagation:

```bash
dig +short mein-kalender.link
dig +short app.mein-kalender.link
```

## Updating Images

### Rolling Update with a Specific Image Tag

After CI/CD builds a new image (e.g., from a commit with SHA `a1b2c3d`):

```bash
# Update API
kubectl set image deployment/calendar-sync-api \
  api=ghcr.io/tuergeist/mein-kalender/api:a1b2c3d \
  -n calendar-sync

# Update Web
kubectl set image deployment/calendar-sync-web \
  web=ghcr.io/tuergeist/mein-kalender/web:a1b2c3d \
  -n calendar-sync

# Update Sync Worker
kubectl set image deployment/calendar-sync-worker \
  sync-worker=ghcr.io/tuergeist/mein-kalender/sync-worker:a1b2c3d \
  -n calendar-sync

# Update Landing
kubectl set image deployment/calendar-sync-landing \
  landing=ghcr.io/tuergeist/mein-kalender/landing:a1b2c3d \
  -n calendar-sync
```

### Rolling Update with latest Tag

If using `latest` tag, force a re-pull:

```bash
kubectl rollout restart deployment/calendar-sync-api -n calendar-sync
kubectl rollout restart deployment/calendar-sync-web -n calendar-sync
kubectl rollout restart deployment/calendar-sync-worker -n calendar-sync
kubectl rollout restart deployment/calendar-sync-landing -n calendar-sync
```

### Checking Rollout Status

```bash
kubectl rollout status deployment/calendar-sync-api -n calendar-sync
kubectl rollout status deployment/calendar-sync-web -n calendar-sync
kubectl rollout status deployment/calendar-sync-worker -n calendar-sync
```

### Rolling Back

If a deployment fails:

```bash
kubectl rollout undo deployment/calendar-sync-api -n calendar-sync
```

## Environment Variables Reference

### Shared Across Services (from Secret)

| Variable                           | Used By         | Description                                   |
|------------------------------------|-----------------|-----------------------------------------------|
| `DATABASE_URL`                     | api, sync-worker | PostgreSQL connection string                  |
| `REDIS_URL`                        | api, sync-worker | Redis connection string for BullMQ            |
| `ENCRYPTION_SECRET`               | api, sync-worker | 32-byte hex key for encrypting OAuth tokens   |
| `GOOGLE_CLIENT_ID`                | api              | Google OAuth client ID (login)                |
| `GOOGLE_CLIENT_SECRET`            | api              | Google OAuth client secret (login)            |
| `GOOGLE_CALENDAR_CLIENT_ID`       | api              | Google OAuth client ID (Calendar API)         |
| `GOOGLE_CALENDAR_CLIENT_SECRET`   | api              | Google OAuth client secret (Calendar API)     |
| `MICROSOFT_CLIENT_ID`             | api              | Microsoft OAuth client ID (login)             |
| `MICROSOFT_CLIENT_SECRET`         | api              | Microsoft OAuth client secret (login)         |
| `MICROSOFT_TENANT_ID`             | api              | Microsoft tenant ID                           |
| `MICROSOFT_CALENDAR_CLIENT_ID`    | api              | Microsoft OAuth client ID (Calendar API)      |
| `MICROSOFT_CALENDAR_CLIENT_SECRET`| api              | Microsoft OAuth client secret (Calendar API)  |

### Web-Only (from Secret and ConfigMap)

| Variable              | Source    | Description                           |
|-----------------------|-----------|---------------------------------------|
| `NEXTAUTH_URL`        | ConfigMap | Public URL of the web app             |
| `NEXTAUTH_SECRET`     | Secret    | NextAuth.js session signing secret    |
| `NEXT_PUBLIC_API_URL` | ConfigMap | API URL (set from `API_INTERNAL_URL`) |

### Shared Config (from ConfigMap)

| Variable             | Description                              | Default                         |
|----------------------|------------------------------------------|---------------------------------|
| `API_INTERNAL_URL`   | Cluster-internal API URL                 | `http://calendar-sync-api:4200` |
| `API_PORT`           | Port the API server listens on           | `4200`                          |
| `API_HOST`           | Host the API server binds to             | `0.0.0.0`                       |

## Full Deployment (All Steps Combined)

For a fresh deployment, run all steps in order:

```bash
# 0. Create namespace
kubectl create namespace calendar-sync
kubectl config set-context --current --namespace=calendar-sync

# 1. Secrets and config (edit secrets.yaml first!)
kubectl apply -f k8s/secrets.yaml

# 2. Data stores
kubectl apply -f k8s/postgres.yaml
kubectl rollout status deployment/postgres
kubectl apply -f k8s/redis.yaml
kubectl rollout status deployment/redis

# 3. Application services (update image references first!)
kubectl apply -f k8s/api.yaml
kubectl rollout status deployment/calendar-sync-api
kubectl apply -f k8s/sync-worker.yaml
kubectl rollout status deployment/calendar-sync-worker
kubectl apply -f k8s/web.yaml
kubectl rollout status deployment/calendar-sync-web

# 4. Landing page (optional)
kubectl apply -f k8s/landing.yaml
kubectl rollout status deployment/calendar-sync-landing

# 5. Ingress (edit hostnames and TLS config first!)
kubectl apply -f k8s/ingress.yaml

# 6. Verify everything
kubectl get pods
kubectl get svc
kubectl get ingress
```

## Troubleshooting

### Pods stuck in ImagePullBackOff

The cluster cannot pull the container image. Check:
- Is the image name/tag correct? `kubectl describe pod <pod-name>`
- Is the registry private? Create an image pull secret (see above).
- Does the GitHub PAT have `read:packages` scope?

### API pod CrashLoopBackOff

Usually a database connection issue. Check:
- Is PostgreSQL running? `kubectl get pods -l app=postgres`
- Is the `DATABASE_URL` correct in the secret?
- Check API logs: `kubectl logs deployment/calendar-sync-api`

### Sync Worker Not Processing Jobs

- Is Redis running? `kubectl get pods -l app=redis`
- Is `REDIS_URL` correct?
- Check worker logs: `kubectl logs deployment/calendar-sync-worker`

### Web App Returns 500 Errors

- Is `NEXTAUTH_SECRET` set?
- Is `NEXTAUTH_URL` set to the correct public URL?
- Can the web pod reach the API? `kubectl exec deployment/calendar-sync-web -- wget -qO- http://calendar-sync-api:4200/health`

### Ingress Not Working

- Is the ingress controller running? `kubectl get pods -n ingress-nginx`
- Are TLS certificates issued? `kubectl get certificates -n calendar-sync`
- Check ingress events: `kubectl describe ingress calendar-sync-ingress`
