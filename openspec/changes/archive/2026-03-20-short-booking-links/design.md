## Context

Current booking URLs: `/book/<username>/<slug>`. The public booking API endpoints are at `/api/public/book/:username/:slug` (info), `/api/public/book/:username/:slug/slots` (slots), and `POST` (create booking).

## Goals / Non-Goals

**Goals:**
- Short anonymous booking URLs: `/B/<5-char-hash>`
- Auto-generated hash, unique across all event types
- Both long and short URLs work simultaneously
- User can toggle short link per event type

**Non-Goals:**
- Custom vanity short codes (just auto-generated)
- URL shortener for non-booking links

## Decisions

### 1. Hash generation

5-character alphanumeric hash (a-z0-9), generated with `crypto.randomBytes(4).toString("base36").slice(0, 5)`. Collision checked on generation — retry if taken.

### 2. Short URL resolution

`/B/:hash` is a Next.js page that:
1. Calls `GET /api/public/book-by-hash/:hash` to resolve the event type → returns `{ username, slug, eventType, host }`
2. Renders the same booking UI as `/book/[username]/[slug]`

Alternative considered: redirect `/B/:hash` → `/book/:username/:slug`. Rejected because it exposes the long URL, defeating the purpose of anonymity.

### 3. API approach

Rather than duplicating all three booking API endpoints for the hash route, the short URL page resolves the hash to `username + slug` on the client, then uses the existing `/api/public/book/:username/:slug/*` endpoints. The only new API endpoint is the hash resolver.

### 4. Toggle in settings

Event type edit modal gets a "Short link" section:
- Toggle on: generates hash, shows the short URL with copy button
- Toggle off: clears the hash, short URL stops working
- The hash is stored on `EventType.shortHash`

## Risks / Trade-offs

- **5-char hash space**: 36^5 = ~60M combinations. More than enough. Collision probability is negligible with a few thousand event types.
- **No redirect**: The short URL renders inline, so the browser URL stays as `/B/x7k2m`. This is intentional for anonymity.
