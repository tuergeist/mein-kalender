# Landing Page Update Plan

Reference: https://www.onecal.io/ (competitor, well-structured landing page)

## Current State

The landing page has 3 generic feature cards (consolidate, copy, booking) + EU hosting badge. No screenshots, no pricing, no login link, no FAQ, no social proof. Many shipped features are missing.

## Gap: Features built but not advertised

- Multi-way sync (bidirectional, multiple targets)
- Blocked/privacy mode ("Busy" only sync)
- Proton Calendar support (page only mentions Google, Outlook, ICS)
- Branding customization (colors, photo, background image, overlay opacity)
- Per-event-type branding overrides
- ICS feed export (subscribable feeds)
- Short booking links (/B/hash)
- Event filters (skip declined, free, work location, all-day)
- Custom working hours per event type
- Image upload for profile/background
- Available days shown on booking calendar (unavailable days grayed out)

## Target Page Structure (inspired by OneCal)

1. **Navbar** — logo, nav links, "Anmelden" (ghost) + "Jetzt starten" (primary)
2. **Hero** — headline, subtitle, CTA, hero screenshot
3. **Provider logos row** — Google, Outlook, Proton, ICS icons
4. **Feature showcase** — 4 feature blocks with screenshots (not just icon + text)
5. **"How it works"** — 3-step flow
6. **Privacy / EU section** — expanded from current trust card
7. **Pricing** — single "Kostenlos" card with feature checklist (future-proof for tiers)
8. **FAQ** — 5-6 common questions
9. **Final CTA banner**
10. **Footer** — links, legal, company info

## Changes

### 1. Navbar update
- Add "Anmelden" link → `https://app.mein-kalender.link/auth/signin` (ghost/secondary style)
- Add nav links: Features (#features), Preise (#pricing), FAQ (#faq)
- Keep "Jetzt starten" primary CTA

### 2. Hero section upgrade
- Keep headline: "Alle deine Kalender an einem Ort"
- Improve subtitle to mention key differentiators (EU, multi-way sync, booking)
- Add a hero screenshot showing the calendar view with multiple sources
- Larger, more prominent CTA

### 3. Provider logos row
- Below hero: Google Calendar, Microsoft Outlook, Proton Calendar, ICS icons in a row
- Text: "Funktioniert mit deinen Kalendern"

### 4. Feature showcase (replace current 3 generic cards)
Each feature gets: headline, description, screenshot, optional "Mehr erfahren" link

- **Kalender zusammenführen** — consolidated calendar view screenshot. "Google, Outlook, Proton und ICS in einer Ansicht."
- **Multi-Sync** — sync config page screenshot. "Synchronisiere in beide Richtungen. Privat → Arbeit und Arbeit → Privat. Privatsphäre-Modus zeigt nur 'Beschäftigt'."
- **Buchungsseiten** — branded booking page screenshot. "Eigene Farben, Logo und Hintergrundbild. Verfügbare Zeiten automatisch berechnet."
- **ICS-Export** — "Erstelle abonnierbare Feeds für beliebige Kalender-Apps."

### 5. "How it works" section
- Step 1: "Kalender verbinden" — Connect Google, Outlook, Proton, or import ICS
- Step 2: "Sync einrichten" — Choose what syncs where, set filters
- Step 3: "Fertig" — Everything stays in sync automatically

### 6. Privacy / EU section (expand existing)
- Keep shield icon and "Gehostet in der EU"
- Add bullets: DSGVO-konform, Server in der EU, Kein Tracking, Privatsphäre-Modus für Sync
- Mention Proton Calendar support as privacy-focused option

### 7. Pricing section
- Single card: "Kostenlos" / Free
- Feature checklist: unlimited calendars, multi-way sync, booking pages, branding, ICS export, EU hosting
- "Jetzt starten" CTA
- Future: add paid tiers when ready

### 8. FAQ section
- "Was ist mein-kalender.link?" — Kurzbeschreibung
- "Welche Kalender werden unterstützt?" — Google, Outlook, Proton, ICS
- "Ist mein-kalender.link kostenlos?" — Ja
- "Wo werden meine Daten gespeichert?" — EU, DSGVO
- "Kann ich Termine in beide Richtungen synchronisieren?" — Ja, mit Privatsphäre-Modus
- "Kann ich meine Buchungsseite anpassen?" — Ja, Farben, Logo, Hintergrund

### 9. Footer upgrade
- Columns: Produkt (features links), Rechtliches (Impressum, Datenschutz), Kontakt
- Company info (already there)
- Consider: comparison pages vs Calendly, Cal.com (SEO, like OneCal does)

## Priority order

1. Navbar: login button + nav links (quick win)
2. Feature showcase with screenshots (biggest impact)
3. Provider logos row
4. Hero screenshot
5. "How it works" section
6. FAQ section
7. Pricing section
8. Footer upgrade
9. Comparison/SEO pages (later)
