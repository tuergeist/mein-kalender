## Why

Long booking URLs like `/book/cbx/30min-call` are unwieldy for sharing verbally, in bios, or on business cards. Users want short, anonymous links like `/B/x7k2m` that don't expose their username or event type name.

## What Changes

- **Short hash per event type**: Optional `shortHash` field on `EventType` (5 chars, auto-generated)
- **Short URL route**: `/B/:hash` resolves to the same booking page as `/book/:username/:slug`
- **Toggle in event type settings**: User can enable/disable the short link per event type
- **Both URLs work**: The long URL continues to work alongside the short one

## Capabilities

### New Capabilities
- `short-booking-links`: Short hash-based booking URLs

### Modified Capabilities
_(none)_

## Impact

- **Database**: Add `shortHash String? @unique` to `EventType`
- **Backend API**: New public route `/api/public/book-by-hash/:hash` that resolves the event type; update event type API to support generating/clearing the hash
- **Frontend**: New Next.js page `/B/[hash]/page.tsx` that fetches event type by hash and renders the same booking UI; toggle + display in event type settings
