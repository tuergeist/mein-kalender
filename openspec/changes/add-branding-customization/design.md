## Context

Booking pages currently use hardcoded gray backgrounds, default blue buttons, and no host identity beyond display name. The User model has an `avatarUrl` field that's never shown on booking pages. There's no file upload infrastructure — avatarUrl comes from OAuth providers via NextAuth.

The booking page at `/book/[username]/[slug]` and `/B/[hash]` renders with Tailwind utility classes and HeroUI components. Colors are hardcoded (`bg-gray-50`, `border-gray-200`, primary blue).

## Goals / Non-Goals

**Goals:**
- Let users set brand colors (primary + accent) that apply to their booking pages
- Display profile photo on booking pages
- Optional background color or image URL for the booking page
- Settings UI for configuring branding
- All branding data served via the public booking API so pages render correctly without auth

**Non-Goals:**
- File upload for images — use URL input for now (avatarUrl already works this way via OAuth). File upload can be added later.
- Custom fonts or CSS injection
- Per-event-type branding (beyond the existing color field)
- Dark mode theming

## Decisions

### Store branding fields directly on User model
Add `brandColor`, `accentColor`, `backgroundUrl` fields to the User table. A separate branding table would add complexity for no benefit — it's always 1:1 with User and the field count is small.

**Alternative considered:** Dedicated `UserBranding` table — rejected because it adds a join for every public booking query and the data is simple enough for flat fields.

### CSS custom properties for dynamic theming
The booking page will set CSS custom properties (`--brand-color`, `--brand-accent`) on a wrapper div. Tailwind classes reference these via `style` attributes or arbitrary value syntax. This avoids runtime style injection and keeps the approach simple.

**Alternative considered:** Generating Tailwind classes dynamically — rejected because Tailwind purges unknown classes at build time.

### URL-based images only (no file upload)
Users paste a URL for their profile photo and background image. The existing `avatarUrl` field (populated by OAuth) already works this way. No need to build upload infrastructure, storage, or CDN integration for v1.

**Alternative considered:** Multipart upload to local storage or S3 — deferred to a follow-up. URL input covers 90% of use cases (Gravatar, LinkedIn photo URLs, hosted images).

### Public API returns branding in existing endpoint
The `GET /api/public/book/:username/:slug` response gets a `branding` object alongside `host` and `eventType`. No new endpoint needed.

## Risks / Trade-offs

- **[User pastes broken image URL]** → Show graceful fallback (hide image, use initials avatar). CSS `object-fit: cover` + `onerror` handler.
- **[Accessibility with custom colors]** → Don't let brand color override text on white — only use it for buttons, accents, and selected states where contrast is controlled.
- **[Mixed content]** → Background image URL could be HTTP on an HTTPS page. Browser blocks it silently — acceptable, no action needed.
