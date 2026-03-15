## Context

Proton Calendar supports sharing calendars via public ICS links (read-only). There is no external write API or CalDAV access without running Proton Bridge locally. The existing `ProtonCalendarProvider` uses CalDAV via Bridge, which is impractical for most users and doesn't support write operations anyway.

The app already has a complete ICS subscription flow: `POST /api/ics/subscribe` fetches an ICS URL, parses events, creates a CalendarSource + CalendarEntry, and sets up hourly refresh. The `/settings/ics` page offers this as a generic "Subscribe to URL" tab.

## Goals / Non-Goals

**Goals:**
- Provide a Proton-branded setup page with clear instructions on how to get a share link
- Reuse the existing ICS subscription backend — no new API endpoints
- Make the flow feel native to Proton (not just "paste a URL")

**Non-Goals:**
- Two-way sync with Proton Calendar (not possible via ICS)
- CalDAV integration via Proton Bridge (too niche, requires local Bridge setup)
- Proton account login or OAuth

## Decisions

### 1. Reuse ICS subscription vs. new Proton-specific backend
**Decision**: Reuse `POST /api/ics/subscribe` as-is.
**Rationale**: Proton's ICS share links are standard ICS URLs. The existing endpoint already handles fetch, parse, source creation, and hourly refresh. Adding a Proton-specific endpoint would duplicate this logic with no benefit.

### 2. Source provider field: "ics" vs. "proton"
**Decision**: Use `provider: "ics"` since the subscription goes through the ICS flow. The label will identify it as Proton (e.g., "Proton Calendar - Personal").
**Rationale**: Using `provider: "proton"` would require the sync worker to handle Proton sources differently, but the data flow is identical to any ICS subscription. Keeping it as "ics" means zero backend changes.

### 3. Remove CalDAV provider
**Decision**: Remove `providers/proton.ts` and its registration in `providers/index.ts`. Remove the `PROTON` enum value from types.
**Rationale**: The CalDAV approach requires running Proton Bridge locally and doesn't support write operations. It's dead code that adds maintenance burden. If CalDAV support is ever needed, it can be reintroduced.

### 4. Page structure
**Decision**: The `/settings/proton` page shows numbered instructions with screenshots/descriptions of the Proton UI steps, followed by a URL input field and submit button. Modeled after the existing `/settings/ics` page layout.
**Rationale**: Users need guidance specific to Proton's UI to find the share link. A generic URL input isn't enough.

## Risks / Trade-offs

- **[Read-only]** → Users cannot create/edit events on Proton Calendar through the app. This is a Proton limitation, not something we can work around. The calendar will be marked `readOnly: true` (already the default for ICS subscriptions).
- **[Share link expiry]** → Proton share links may be revokable. If revoked, the ICS sync will fail silently (fetch returns error). The existing `syncStatus: "error"` handling covers this.
- **[Refresh frequency]** → ICS subscriptions default to hourly refresh. Proton Calendar changes won't appear instantly. This is acceptable for a read-only view.
