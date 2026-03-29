# Design System — Mein Kalender

## Product Context
- **What this is:** Multi-calendar sync platform with booking pages — aggregates Google, Outlook, and Proton calendars into one view
- **Who it's for:** Professionals juggling multiple calendar providers, primarily German-speaking
- **Space/industry:** Calendar/scheduling (competitors: Cal.com, Calendly, SavvyCal, OneCal, Morgen)
- **Project type:** Web app (Next.js 15 + React 19 + HeroUI + Tailwind)
- **Positioning:** Lower price point, fast feature delivery, referral-based growth

## Aesthetic Direction
- **Direction:** Industrial/Refined — Swiss precision with warmth
- **Decoration level:** Intentional — subtle grain texture on surfaces for tactile depth
- **Mood:** Expertly crafted, warm, confident. Not clinical SaaS, not playful startup. A well-made European tool.
- **Reference sites:** SavvyCal (warmth, personality), Linear (precision, craft), Morgen (premium feel)

## Typography
- **Display/Hero:** Satoshi (fontshare.com) — geometric sans with character, designed for modern interfaces. Not Inter, not Roboto.
- **Body:** DM Sans — excellent readability at small sizes, pairs naturally with Satoshi
- **UI/Labels:** DM Sans (same as body, 500 weight for labels)
- **Data/Tables:** Geist Mono (tabular-nums) — crisp for times, dates, and numerical data
- **Code:** Geist Mono
- **Loading:** Satoshi via `https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap`, DM Sans + Geist Mono via Google Fonts
- **Scale:**
  - Hero: 52px / 700 / -0.04em tracking / 1.1 line-height
  - H1: 28px / 700 / -0.03em / 1.2
  - H2: 22px / 600 / -0.02em / 1.35
  - H3: 18px / 500 / -0.01em / 1.4
  - Body: 16px / 400 / normal / 1.6
  - Small: 14px / 400 / normal / 1.5
  - Caption: 12px / 500 / normal / 1.4
  - Mono labels: 11px / 500 / 0.08em tracking / uppercase

## Color
- **Approach:** Balanced — primary for brand and interactive elements, amber accent for energy and highlights
- **Primary (Deep Rose):**
  - 50: #FFF1F2
  - 100: #FFE4E6
  - 200: #FECDD3
  - 300: #FDA4AF
  - 400: #FB7185
  - 500: #F43F5E
  - 600: #E11D48
  - 700: #9F1239 (primary interactive)
  - 800: #881337
  - 900: #4C0519
- **Accent (Warm Amber):**
  - 50: #FFFBEB
  - 100: #FEF3C7
  - 200: #FDE68A
  - 300: #FCD34D
  - 400: #FBBF24
  - 500: #F59E0B
  - 600: #D97706 (accent interactive)
  - 700: #B45309
  - 800: #92400E
  - 900: #78350F
- **Neutrals (Warm Stone):**
  - 50: #FAFAF9
  - 100: #F5F5F4
  - 200: #E7E5E4
  - 300: #D6D3D1
  - 400: #A8A29E
  - 500: #78716C
  - 600: #57534E
  - 700: #44403C
  - 800: #292524
  - 900: #1C1917
- **Semantic:**
  - Success: #059669
  - Warning: #D97706
  - Error: #DC2626
  - Info: #0284C7
- **Surfaces (Light):**
  - Page background: #FAFAF9 (stone-50)
  - Card/elevated: #FFFFFF
  - Sidebar: #1C1917 (stone-900)
  - Border default: #E7E5E4 (stone-200)
  - Border subtle: #F5F5F4 (stone-100)
  - Text primary: #1C1917
  - Text secondary: #57534E
  - Text tertiary: #78716C
- **Dark mode:** Invert surfaces (page: stone-900, card: stone-800), reduce primary saturation ~10%, keep amber vibrant

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)

## Layout
- **Approach:** Grid-disciplined
- **Grid:** Sidebar (200-224px) + main content area
- **Max content width:** 1120px
- **Border radius:** sm:4px, md:8px, lg:12px, xl:16px, full:9999px (pills/chips)
- **Shadows:**
  - sm: 0 1px 2px rgba(0, 0, 0, 0.06)
  - md: 0 2px 8px rgba(0, 0, 0, 0.08)
  - lg: 0 4px 16px rgba(0, 0, 0, 0.1)

## Motion
- **Approach:** Intentional — subtle entrance animations on cards/modals, meaningful state transitions. No bouncing, no parallax.
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms) long(400-700ms)

## Grain Texture
Apply a subtle SVG noise overlay on body (opacity 0.03, pointer-events: none) for tactile depth. This is the "craft" detail that separates from flat clinical SaaS.

## Font Blacklist
Never use: Inter, Roboto, Poppins, Montserrat, Open Sans, Lato as primary fonts in this project. These are the "template look" we're deliberately moving away from.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-27 | Deep Rose #9F1239 as primary | Distinctive in scheduling space — no competitor uses rose/berry. Warm, bold, memorable. |
| 2026-03-27 | Warm Amber #D97706 as accent | Energy and warmth. Pairs with rose for a warm palette nobody else has. |
| 2026-03-27 | Satoshi for display, DM Sans for body | Geometric precision with character. Avoids the Inter/Roboto template look. |
| 2026-03-27 | Subtle grain texture on surfaces | Adds tactile craft feel, moves away from flat clinical SaaS. |
| 2026-03-27 | Warm Stone neutrals (not cool grays) | Reinforces the warm, approachable aesthetic vs. cold/corporate. |
| 2026-03-27 | Teal rejected as primary | Already used for heykurt.de — need distinct brand identity. |
