# mein-kalender.link — Brand Styleguide

> **Purpose**: Reference document for Claude Code and all development work on mein-kalender.link.
> Keep this file as `BRAND.md` in the project root.

---

## 1. Brand overview

**Product**: mein-kalender.link
**What it does**: Calendar consolidation, calendar copying, and booking pages.
**Infrastructure**: EU-hosted servers.
**Tone**: Professional but approachable. German-first, English-ready. Clear, not corporate.

---

## 2. Logo

### Variants

| Variant | File | Use case |
|---------|------|----------|
| Full logo (light) | `logo-full.svg` | Website hero, marketing, docs on light bg |
| Full logo (dark) | `logo-full-dark.svg` | Dark backgrounds, dark mode |
| Horizontal wordmark | `logo-horizontal.svg` | Navbar, email signatures, inline usage |
| Icon only | `logo-icon.svg` | Favicon, app icon, social avatar |

### Logo concept

Three overlapping calendar pages (teal → blue → purple) represent **consolidation** of multiple calendar sources. The front page (purple) is the unified view. A green checkmark badge represents **booking confirmation**. The selected day (highlighted dot with ring) represents an **active booking slot**.

### Clear space

Maintain minimum padding of **1× the icon height** around the full logo. For the horizontal wordmark, maintain **0.5× icon width** on all sides.

### Don'ts

- Don't rotate or skew the logo
- Don't change the color relationships between calendar pages
- Don't use the wordmark without the icon in the horizontal variant
- Don't place the light variant on dark backgrounds (use the dark variant)

---

## 3. Colors

### Primary palette

```css
:root {
  /* Purple — Primary brand, CTAs, active states */
  --color-purple-50:  #EEEDFE;
  --color-purple-100: #CECBF6;
  --color-purple-200: #AFA9EC;
  --color-purple-400: #7F77DD;
  --color-purple-600: #534AB7;
  --color-purple-800: #3C3489;
  --color-purple-900: #26215C;

  /* Teal — Success, booking confirmed, secondary accent */
  --color-teal-50:  #E1F5EE;
  --color-teal-100: #9FE1CB;
  --color-teal-200: #5DCAA5;
  --color-teal-400: #1D9E75;
  --color-teal-600: #0F6E56;
  --color-teal-800: #085041;
  --color-teal-900: #04342C;

  /* Blue — Calendar source indicator, info states */
  --color-blue-50:  #E6F1FB;
  --color-blue-100: #B5D4F4;
  --color-blue-200: #85B7EB;
  --color-blue-400: #378ADD;
  --color-blue-600: #185FA5;
  --color-blue-800: #0C447C;
  --color-blue-900: #042C53;
}
```

### Semantic tokens

```css
:root {
  /* Surfaces */
  --bg-primary:    #FFFFFF;
  --bg-secondary:  #F8F7F5;
  --bg-tertiary:   #F1EFE8;
  --bg-elevated:   #FFFFFF;

  /* Text */
  --text-primary:   #2C2C2A;
  --text-secondary: #5F5E5A;
  --text-tertiary:  #888780;
  --text-inverse:   #FFFFFF;

  /* Borders */
  --border-default:  #D3D1C7;
  --border-subtle:   #E8E6DF;
  --border-strong:   #B4B2A9;

  /* Interactive */
  --interactive-primary:       var(--color-purple-400);   /* #7F77DD */
  --interactive-primary-hover: var(--color-purple-600);   /* #534AB7 */
  --interactive-primary-text:  #FFFFFF;

  /* Status */
  --status-success:     var(--color-teal-400);    /* #1D9E75 */
  --status-success-bg:  var(--color-teal-50);     /* #E1F5EE */
  --status-info:        var(--color-blue-400);     /* #378ADD */
  --status-info-bg:     var(--color-blue-50);      /* #E6F1FB */
  --status-warning:     #BA7517;
  --status-warning-bg:  #FAEEDA;
  --status-error:       #E24B4A;
  --status-error-bg:    #FCEBEB;
}
```

### Dark mode

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary:    #1A1A1E;
    --bg-secondary:  #232326;
    --bg-tertiary:   #2C2C30;
    --bg-elevated:   #2C2C30;

    --text-primary:   #E8E6DF;
    --text-secondary: #B4B2A9;
    --text-tertiary:  #888780;

    --border-default:  #444441;
    --border-subtle:   #333331;
    --border-strong:   #5F5E5A;

    --interactive-primary:       var(--color-purple-200);  /* #AFA9EC */
    --interactive-primary-hover: var(--color-purple-100);  /* #CECBF6 */
    --interactive-primary-text:  var(--color-purple-900);  /* #26215C */
  }
}
```

### Usage rules

| Context | Color |
|---------|-------|
| Primary buttons, links, focus rings | `--interactive-primary` (purple-400 / purple-200 dark) |
| Booking confirmed, success toast | `--status-success` (teal-400) |
| Calendar source badges | purple-50/400, blue-50/400, teal-50/400 |
| Danger / destructive actions | `--status-error` |
| Body text | `--text-primary` |
| Muted labels, timestamps | `--text-secondary` |
| Placeholder text | `--text-tertiary` |
| Card backgrounds | `--bg-elevated` |
| Page background | `--bg-primary` |
| Dividers, card borders | `--border-default` |

---

## 4. Typography

### Font stack

```css
:root {
  --font-sans:  'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
  --font-mono:  'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
}
```

**Primary**: [Inter](https://rsms.me/inter/) — Load weights 400, 500, 600.
**Monospace**: JetBrains Mono — for code blocks, technical values, calendar IDs.

### Type scale

| Token | Size | Weight | Line height | Use |
|-------|------|--------|-------------|-----|
| `--text-display` | 36px | 600 | 1.2 | Hero headlines |
| `--text-h1` | 28px | 600 | 1.3 | Page titles |
| `--text-h2` | 22px | 600 | 1.35 | Section headings |
| `--text-h3` | 18px | 500 | 1.4 | Card titles, sub-sections |
| `--text-body` | 16px | 400 | 1.6 | Body text, descriptions |
| `--text-body-medium` | 16px | 500 | 1.6 | Emphasized body (labels, nav) |
| `--text-small` | 14px | 400 | 1.5 | Helper text, metadata |
| `--text-caption` | 12px | 400 | 1.4 | Timestamps, badges, fine print |

### CSS implementation

```css
body {
  font-family: var(--font-sans);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1 { font-size: 28px; font-weight: 600; line-height: 1.3; letter-spacing: -0.3px; }
h2 { font-size: 22px; font-weight: 600; line-height: 1.35; }
h3 { font-size: 18px; font-weight: 500; line-height: 1.4; }
```

---

## 5. Spacing & layout

### Spacing scale (base 4px)

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

### Border radius

```css
:root {
  --radius-sm:   4px;   /* Badges, small chips */
  --radius-md:   8px;   /* Buttons, inputs, small cards */
  --radius-lg:  12px;   /* Cards, modals, calendar day cells */
  --radius-xl:  16px;   /* Large cards, hero sections */
  --radius-full: 9999px; /* Avatars, pills, toggle tracks */
}
```

### Shadows (light mode only; dark mode uses borders)

```css
:root {
  --shadow-sm:  0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-md:  0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-lg:  0 4px 16px rgba(0, 0, 0, 0.1);
  --shadow-xl:  0 8px 32px rgba(0, 0, 0, 0.12);
}
```

---

## 6. Components

### Buttons

```css
/* Primary */
.btn-primary {
  background: var(--interactive-primary);
  color: var(--interactive-primary-text);
  font-weight: 500;
  font-size: 14px;
  padding: 10px 20px;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
}
.btn-primary:hover { background: var(--interactive-primary-hover); }

/* Secondary */
.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  padding: 10px 20px;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 14px;
}
.btn-secondary:hover { background: var(--bg-secondary); }

/* Ghost */
.btn-ghost {
  background: transparent;
  color: var(--interactive-primary);
  border: none;
  padding: 10px 20px;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 14px;
}
.btn-ghost:hover { background: var(--color-purple-50); }
```

### Cards

```css
.card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}
```

### Input fields

```css
.input {
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-size: 16px;
  font-family: var(--font-sans);
  color: var(--text-primary);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.input:focus {
  outline: none;
  border-color: var(--interactive-primary);
  box-shadow: 0 0 0 3px rgba(127, 119, 221, 0.15);
}
.input::placeholder { color: var(--text-tertiary); }
```

### Calendar source badges

```css
/* Each calendar source gets a distinct color from the brand triad */
.badge-source-google   { background: var(--color-blue-50);   color: var(--color-blue-800);   }
.badge-source-outlook  { background: var(--color-teal-50);   color: var(--color-teal-800);   }
.badge-source-ical     { background: var(--color-purple-50); color: var(--color-purple-800); }
```

### Booking page slots

```css
.slot {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  transition: all 0.15s ease;
}
.slot:hover {
  border-color: var(--interactive-primary);
  background: var(--color-purple-50);
}
.slot--selected {
  background: var(--interactive-primary);
  color: var(--interactive-primary-text);
  border-color: var(--interactive-primary);
}
.slot--unavailable {
  opacity: 0.4;
  cursor: not-allowed;
}
```

---

## 7. Iconography

Use [Lucide Icons](https://lucide.dev/) as the icon set.

- **Size**: 20px default, 16px for inline/small, 24px for nav/prominent
- **Stroke width**: 1.5px (matches the overall light, clean aesthetic)
- **Color**: Inherit from parent text color by default

Key icons used across the app:

| Concept | Lucide icon |
|---------|-------------|
| Calendar | `calendar` |
| Booking / check | `calendar-check` |
| Copy calendar | `copy` or `calendar-plus` |
| Consolidate | `layers` or `combine` |
| Settings | `settings` |
| User/profile | `user` |
| Link/share | `link` |
| EU/privacy | `shield-check` |
| Time slot | `clock` |
| External calendar | `external-link` |

---

## 8. Motion

```css
:root {
  --transition-fast:   0.1s ease;
  --transition-normal: 0.15s ease;
  --transition-slow:   0.25s ease-out;
}

/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
```

- Button hover/active: `--transition-fast`
- Card hover lift, input focus ring: `--transition-normal`
- Modal enter/exit, page transitions: `--transition-slow`
- No bouncing, no spring physics. Clean and direct.

---

## 9. Copy & voice

### Tone

- **Professional but warm** — not corporate-speak, not overly casual
- **German-first** — all UI copy in German by default. English for international booking pages.
- **Clear and direct** — use active voice. "Dein Kalender wurde synchronisiert." not "Die Synchronisierung des Kalenders wurde durchgeführt."
- **Helpful, not clever** — no puns or wordplay in UI. Save personality for marketing.

### Key terms (German)

| Concept | Term | Notes |
|---------|------|-------|
| Calendar consolidation | "Kalender zusammenführen" | Not "konsolidieren" in UI |
| Copy calendar | "Kalender kopieren" | |
| Booking page | "Buchungsseite" | |
| Time slot | "Zeitfenster" | Not "Slot" |
| Availability | "Verfügbarkeit" | |
| Connected calendar | "Verbundener Kalender" | |
| Sync status | "Synchronisierungsstatus" | Abbreviated: "Sync-Status" |

### EU hosting messaging

When communicating EU hosting as a feature:

- **Short**: "Gehostet in der EU"
- **Medium**: "Deine Daten bleiben in der EU — gehostet auf europäischen Servern."
- **Long**: "mein-kalender.link wird ausschließlich auf Servern in der Europäischen Union betrieben. Deine Kalenderdaten unterliegen der DSGVO und verlassen die EU nicht."

---

## 10. Tailwind CSS configuration

If using Tailwind, extend the config:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        purple: {
          50:  '#EEEDFE',
          100: '#CECBF6',
          200: '#AFA9EC',
          400: '#7F77DD',
          600: '#534AB7',
          800: '#3C3489',
          900: '#26215C',
        },
        teal: {
          50:  '#E1F5EE',
          100: '#9FE1CB',
          200: '#5DCAA5',
          400: '#1D9E75',
          600: '#0F6E56',
          800: '#085041',
          900: '#04342C',
        },
        blue: {
          50:  '#E6F1FB',
          100: '#B5D4F4',
          200: '#85B7EB',
          400: '#378ADD',
          600: '#185FA5',
          800: '#0C447C',
          900: '#042C53',
        },
        surface: {
          primary:   'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          elevated:  'var(--bg-elevated)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      borderRadius: {
        sm:   '4px',
        md:   '8px',
        lg:  '12px',
        xl:  '16px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.06)',
        md: '0 2px 8px rgba(0, 0, 0, 0.08)',
        lg: '0 4px 16px rgba(0, 0, 0, 0.1)',
        xl: '0 8px 32px rgba(0, 0, 0, 0.12)',
      },
    },
  },
}
```

---

## 11. File checklist

```
branding/
├── logo-full.svg           # Full logo, light background
├── logo-full-dark.svg      # Full logo, dark background
├── logo-horizontal.svg     # Horizontal wordmark + icon
├── logo-icon.svg           # Icon only (256×256)
└── BRAND.md                # This file
```

Generate favicon sizes from `logo-icon.svg`:
- `favicon.ico` — 32×32
- `apple-touch-icon.png` — 180×180
- `icon-192.png` — 192×192 (PWA)
- `icon-512.png` — 512×512 (PWA)
- `og-image.png` — 1200×630 (social sharing, use full logo on brand bg)
