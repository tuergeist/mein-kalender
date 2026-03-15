## Why

The app supports Google, Outlook, and generic ICS sources, but the "Proton Calendar (via Bridge)" button in settings leads to a non-existent page. Proton Calendar does not support external write access — the only way to consume it externally is via ICS share links (read-only). The existing ICS subscription backend already handles this, but users need Proton-specific guidance to find their share link.

## What Changes

- Add a `/settings/proton` page with step-by-step instructions for getting a Proton Calendar share link
- The page collects the ICS URL and optional label, then calls the existing `POST /api/ics/subscribe` endpoint
- The source is created with `provider: "ics"` (not "proton") since it uses the standard ICS subscription flow
- Remove or repurpose the unused CalDAV-based `ProtonCalendarProvider` in `providers/proton.ts`

## Capabilities

### New Capabilities
- `proton-setup-page`: A guided setup page at `/settings/proton` that walks users through sharing their Proton Calendar via link and subscribing to it

### Modified Capabilities
_(none — reuses existing ICS subscription backend as-is)_

## Impact

- **Frontend**: New page at `packages/web/src/app/settings/proton/page.tsx`
- **Backend**: No changes — uses existing `POST /api/ics/subscribe`
- **Cleanup**: `packages/backend/src/providers/proton.ts` can be removed (CalDAV approach is not viable without Bridge + no write access)
- **Dependencies**: None
