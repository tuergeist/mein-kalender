## Why

Booking pages are generic — every user's page looks the same with hardcoded gray backgrounds and default blue buttons. Users need to make their booking pages feel like their own brand: their colors, their photo, their identity. This builds trust with guests and makes the product feel professional.

## What Changes

- Add user-level branding settings: primary/accent color, profile photo URL, and optional hero/background image URL
- Display the user's profile photo on booking pages (the `avatarUrl` field exists but is never shown)
- Apply brand colors to booking page buttons, selected states, and accents via CSS custom properties
- Optional background color or image on booking pages
- New branding settings section in the UI for configuring colors and uploading/setting images
- Public booking API returns branding data so booking pages can render it

## Capabilities

### New Capabilities
- `branding`: User-level brand customization — colors, profile photo, background image — stored in DB, exposed via API, applied on booking pages

### Modified Capabilities
- `booking-page`: Booking page renders user's brand colors, profile photo, and optional background instead of hardcoded defaults

## Impact

- **Database**: New fields on User model (brandColor, accentColor, backgroundImageUrl) or a dedicated branding table
- **API**: `GET /api/profile` and public booking endpoints return branding data; `PUT /api/profile` accepts branding fields
- **Frontend**: Booking page (`/book/[username]/[slug]` and `/B/[hash]`) uses CSS custom properties for dynamic theming; new branding settings UI section
- **No breaking changes** — existing booking pages continue to work with default styling when no branding is configured
