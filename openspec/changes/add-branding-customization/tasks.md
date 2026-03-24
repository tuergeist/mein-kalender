## 1. Database

- [x] 1.1 Add `brandColor`, `accentColor`, `backgroundUrl` fields to User model in schema.prisma (all optional String?)
- [x] 1.2 Create and run migration

## 2. Backend API

- [x] 2.1 Add `PUT /api/profile/branding` endpoint — accepts `brandColor`, `accentColor`, `avatarUrl`, `backgroundUrl`; validates hex color format; saves to User
- [x] 2.2 Update `GET /api/public/book/:username/:slug` to return `branding` object (brandColor, accentColor, avatarUrl, backgroundUrl) from host's User record
- [x] 2.3 Update `GET /api/public/book-by-hash/:hash` to return same `branding` object

## 3. Booking Page Theming

- [x] 3.1 Update `/book/[username]/[slug]/page.tsx` to read `branding` from API response and set CSS custom properties (`--brand-color`, `--brand-accent`) on wrapper
- [x] 3.2 Replace hardcoded button/accent colors with brand color references (selected dates, primary buttons, active states)
- [x] 3.3 Display host profile photo (avatarUrl) next to display name with `onerror` fallback
- [x] 3.4 Apply background color or image from `backgroundUrl` with dimming overlay for readability
- [x] 3.5 Update `/B/[hash]/page.tsx` with same branding changes (shared component or duplicated logic)

## 4. Branding Settings UI

- [x] 4.1 Add branding settings card to booking settings page with color pickers for brandColor and accentColor
- [x] 4.2 Add URL inputs for profile photo and background image with live preview
- [x] 4.3 Wire save button to `PUT /api/profile/branding` and load existing values on mount via `GET /api/profile`

## 5. Verification

- [x] 5.1 Verify booking page renders with default styling when no branding is configured
- [x] 5.2 Verify brand colors apply to buttons, selected states, and accents on booking page
- [x] 5.3 Verify broken image URL gracefully falls back (no broken image icon)
