## 1. Backend Cleanup

- [x] 1.1 Delete `packages/backend/src/providers/proton.ts`
- [x] 1.2 Remove `PROTON` from `Provider` enum in `packages/backend/src/types.ts`
- [x] 1.3 Remove Proton case from `getProvider()` in `packages/backend/src/providers/index.ts`
- [x] 1.4 Verify backend compiles with `npx tsc --noEmit`

## 2. Frontend Setup Page

- [x] 2.1 Create `packages/web/src/app/settings/proton/page.tsx` with AppShell wrapper, back button, and page title
- [x] 2.2 Add step-by-step instructions for getting a Proton Calendar share link (open Proton Calendar → calendar settings → Share → "Share with anyone" → copy link)
- [x] 2.3 Add URL input field and optional label input
- [x] 2.4 Add submit button that calls `POST /api/ics/subscribe` with the URL and label (default label: "Proton Calendar")
- [x] 2.5 Handle success: show event count, redirect to `/settings` after short delay
- [x] 2.6 Handle errors: display error message for unreachable URL, invalid ICS, or network failure
- [x] 2.7 Disable submit button when URL is empty

## 3. Verification

- [x] 3.1 Verify frontend compiles with `npx tsc --noEmit`
- [ ] 3.2 Test end-to-end: navigate to settings → Add Calendar → Proton → paste share link → verify events appear in calendar view
