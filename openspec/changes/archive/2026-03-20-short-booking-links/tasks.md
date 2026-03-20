## 1. Database

- [x] 1.1 Add `shortHash String? @unique` to `EventType` model
- [x] 1.2 Create migration, regenerate Prisma client

## 2. Backend API

- [x] 2.1 Create `GET /api/public/book-by-hash/:hash` endpoint (no auth) — resolve hash to username, slug, event type info, host
- [x] 2.2 Add hash generation logic to event type PUT: when `enableShortLink: true` → generate hash; when `false` → clear hash
- [x] 2.3 Register hash resolver route in server.ts (without auth)

## 3. Frontend — Short URL page

- [x] 3.1 Create `/B/[hash]/page.tsx` — fetch event type via hash resolver, render booking UI inline (full standalone booking page, no redirect)
- [x] 3.2 Ensure `/B/*` is NOT protected by Next.js middleware

## 4. Frontend — Event type settings

- [x] 4.1 Add short link toggle in event type edit modal
- [x] 4.2 When enabled: show short URL with copy button (primary-colored to distinguish from long URL)
- [x] 4.3 Send `enableShortLink` in update request
