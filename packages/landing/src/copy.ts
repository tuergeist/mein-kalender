/**
 * Landing page text, German and English.
 *
 * English exists because the acquisition plan's second channel is the Proton
 * community — r/ProtonMail, r/privacy, r/degoogle — which is English-speaking.
 * MARKETING.md even contains a ready-made English Reddit post linking here; a
 * German-only page loses those readers at the door.
 *
 * Both languages live in one file so a change to one is visibly a change to
 * the other. The legal pages stay German: a German company's Impressum and
 * Datenschutzerklärung are German documents.
 */

export type Lang = "de" | "en";

export interface Copy {
  htmlLang: string;
  title: string;
  description: string;
  nav: { features: string; pricing: string; signIn: string; cta: string };
  hero: { h1: string; sub: string; subMuted: string; ctaNote: string };
  trust: { h2: string; body: string; alt: string };
  hosting: { h2: string; body: string };
  features: Array<{ h2: string; body: string; img: string; alt: string; reversed: boolean }>;
  pricing: {
    h2: string;
    toggleLabel: string;
    monthly: string;
    yearly: string;
    save: string;
    plans: { monthly: { price: string; period: string; note: string }; yearly: { price: string; period: string; note: string } };
    features: string[];
  };
  finalCta: { h2: string; button: string };
  /** Shown under the price list. Only set where there is something to disclose. */
  disclosure?: string;
  footer: { imprint: string; privacy: string };
  langSwitch: { label: string; other: string; otherHref: string };
}

export const copy: Record<Lang, Copy> = {
  de: {
    htmlLang: "de",
    title: "mein-kalender.link — Ein Kalender für alle deine Rollen",
    description:
      "Google, Outlook und Proton in einem Kalender. Andere Werkzeuge planen Termine — Mein Kalender sorgt dafür, dass deine Kalender sich einig sind, wann du frei bist. Gehostet in der EU.",
    nav: { features: "Features", pricing: "Preise", signIn: "Anmelden", cta: "Kostenlos testen" },
    hero: {
      h1: "Ein Kalender für alle deine Rollen.",
      sub: "Andere Werkzeuge planen Termine. Mein Kalender sorgt dafür, dass deine Kalender sich einig sind, wann du frei bist.",
      subMuted: "Google, Outlook und Proton — alles auf einen Blick.",
      ctaNote: "14 Tage kostenlos. Keine Kreditkarte nötig.",
    },
    trust: {
      h2: "Du siehst sofort, ob alles funktioniert.",
      body: "Termine der Woche, offene Überschneidungen, verbundene Kalender und der Zustand jeder Verbindung — auf einer Seite, ohne Suchen.",
      alt: "Dashboard von Mein Kalender: 12 Termine diese Woche, keine Überschneidungen, drei Kalender verbunden, Status Alles OK.",
    },
    hosting: {
      h2: "In Europa gebaut, in Europa gehostet.",
      body: "Server in Deutschland, Mailversand in Frankreich, Sicherungen in den Niederlanden. Keine Auftragsverarbeitung in den USA — auch nicht für Schriften oder Statistik. Betrieben von einer deutschen UG, nicht von einer Holding in Delaware.",
    },
    features: [
      {
        h2: "So viele Buchungsseiten, wie du Rollen hast.",
        body: "Jede mit eigenem Logo, eigenem Hintergrund, eigenen Farben — dein Beratungsmandat sieht anders aus als dein Board-Sitz. Die Zahl ist nicht gedeckelt, die der Kalender auch nicht.",
        img: "/screenshots/buchungsseite.jpg",
        alt: "Buchungsseite mit eigenem Branding: Hintergrundbild, Porträt und eigene Typografie über dem Buchungsformular.",
        reversed: false,
      },
      {
        h2: "Proton. Outlook. Google. Alles im Blick.",
        body: "Google und Outlook gleichen sich in beide Richtungen ab. Proton Calendar bindest du als Leseansicht ein — ohne Bridge, ohne Umweg.",
        img: "/screenshots/wochenansicht.jpg",
        alt: "Wochenansicht mit Terminen aus Google, Outlook und Proton Calendar, farblich getrennt; der Proton-Kalender ist als schreibgeschützt markiert.",
        reversed: true,
      },
      {
        h2: "Überschneidungen sofort erkennen.",
        body: "Board Meeting um 14 Uhr bei Firma A, Kundencall um 14 Uhr bei Firma B? Wir sagen dir Bescheid.",
        img: "/screenshots/ueberschneidungen.jpg",
        alt: "Erkannte Terminüberschneidung zwischen einem Outlook- und einem Google-Termin am selben Vormittag.",
        reversed: false,
      },
    ],
    pricing: {
      h2: "Ein Plan. Alles drin.",
      toggleLabel: "Abrechnungszeitraum",
      monthly: "Monatlich",
      yearly: "Jährlich",
      save: "−17 %",
      plans: {
        monthly: { price: "5 €", period: "/Monat", note: "inkl. MwSt. · monatlich kündbar" },
        yearly: { price: "50 €", period: "/Jahr", note: "inkl. MwSt. · entspricht 4,17 € im Monat" },
      },
      features: [
        "Multi-Kalender-Sync",
        "Gebrandete Buchungsseiten",
        "Sync-Cockpit",
        "Proton Calendar (Leseansicht)",
        "Überschneidungs-Erkennung",
        "Unbegrenzte Kalender",
      ],
    },
    finalCta: { h2: "Schluss mit Kalender-Chaos.", button: "Jetzt starten" },
    footer: { imprint: "Impressum", privacy: "Datenschutz" },
    langSwitch: { label: "Sprache", other: "English", otherHref: "/en/" },
  },

  en: {
    htmlLang: "en",
    title: "mein-kalender.link — One calendar for every role you play",
    description:
      "Google, Outlook and Proton in one calendar. Other tools schedule meetings — Mein Kalender makes sure your calendars agree on when you are free. Hosted in the EU.",
    nav: { features: "Features", pricing: "Pricing", signIn: "Sign in", cta: "Start free trial" },
    hero: {
      h1: "One calendar for every role you play.",
      sub: "Other tools schedule meetings. Mein Kalender makes sure your calendars agree on when you are free.",
      subMuted: "Google, Outlook and Proton — in one view.",
      ctaNote: "14 days free. No credit card.",
    },
    trust: {
      h2: "You can see at a glance that it works.",
      body: "This week's appointments, open clashes, connected calendars and the state of every connection — on one page, without digging.",
      alt: "Mein Kalender dashboard: 12 appointments this week, no clashes, three calendars connected, status all OK.",
    },
    hosting: {
      h2: "Built in Europe, hosted in Europe.",
      body: "Servers in Germany, mail delivery in France, backups in the Netherlands. No processor in the United States — not for fonts and not for analytics either. Run by a German company, not by a holding in Delaware.",
    },
    features: [
      {
        h2: "As many booking pages as you have roles.",
        body: "Each with its own logo, background and colours — your consulting mandate does not have to look like your board seat. There is no cap on the number, and none on calendars either.",
        img: "/screenshots/buchungsseite.jpg",
        alt: "A booking page with its own branding: background image, portrait and typography above the booking form.",
        reversed: false,
      },
      {
        h2: "Proton. Outlook. Google. One view.",
        body: "Google and Outlook sync both ways. Proton Calendar comes in as a read-only view — no bridge, no workaround.",
        img: "/screenshots/wochenansicht.jpg",
        alt: "Week view with appointments from Google, Outlook and Proton Calendar in distinct colours; the Proton calendar is marked read-only.",
        reversed: true,
      },
      {
        h2: "Spot the clash before it happens.",
        body: "Board meeting at 2pm at company A, client call at 2pm at company B? You get told.",
        img: "/screenshots/ueberschneidungen.jpg",
        alt: "A detected clash between an Outlook appointment and a Google appointment on the same morning.",
        reversed: false,
      },
    ],
    pricing: {
      h2: "One plan. Everything in it.",
      toggleLabel: "Billing period",
      monthly: "Monthly",
      yearly: "Yearly",
      save: "−17%",
      plans: {
        monthly: { price: "€5", period: "/month", note: "incl. VAT · cancel any month" },
        yearly: { price: "€50", period: "/year", note: "incl. VAT · works out at €4.17 a month" },
      },
      features: [
        "Multi-calendar sync",
        "Branded booking pages",
        "Sync cockpit",
        "Proton Calendar (read-only)",
        "Clash detection",
        "Unlimited calendars",
      ],
    },
    finalCta: { h2: "Enough calendar chaos.", button: "Get started" },
    // Said plainly rather than discovered after signing up: the app itself is
    // German. Only the public booking pages are translated (i18n.ts covers
    // booking/manage/short/tz), and those are what your invitees see.
    disclosure:
      "One thing to know before you sign up: the app interface is German. The booking pages your invitees see are available in English, German, French, Spanish and Dutch.",
    footer: { imprint: "Imprint", privacy: "Privacy" },
    langSwitch: { label: "Language", other: "Deutsch", otherHref: "/" },
  },
};
