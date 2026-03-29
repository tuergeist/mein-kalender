import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--bg-secondary)]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between px-6 py-3">
          <Link href="/">
            <img src="/logo-horizontal.svg" alt="mein-kalender.link" className="h-8" />
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="font-[family-name:var(--font-dm-sans)] text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
              Features
            </a>
            <a href="#preise" className="font-[family-name:var(--font-dm-sans)] text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
              Preise
            </a>
            <Link href="/auth/signin" className="font-[family-name:var(--font-dm-sans)] text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
              Anmelden
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-lg bg-[var(--color-rose-700)] px-5 py-2 font-[family-name:var(--font-dm-sans)] text-sm font-medium text-white shadow-sm transition-all hover:bg-[var(--color-rose-800)] hover:shadow-md"
            >
              Kostenlos testen
            </Link>
          </div>
          {/* Mobile: just CTA */}
          <Link
            href="/auth/signup"
            className="rounded-lg bg-[var(--color-rose-700)] px-4 py-2 font-[family-name:var(--font-dm-sans)] text-sm font-medium text-white md:hidden"
          >
            Kostenlos testen
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-12 px-6 py-24 md:flex-row md:items-start md:py-32 lg:py-40">
          {/* Text — left 60% */}
          <div className="flex max-w-2xl flex-col gap-6 text-center md:w-[60%] md:text-left">
            <h1 className="font-[family-name:var(--font-satoshi)] text-4xl font-bold leading-[1.1] tracking-[-0.04em] text-[var(--text-primary)] md:text-[52px]">
              Nie wieder doppelt gebucht.
            </h1>
            <p className="font-[family-name:var(--font-dm-sans)] text-lg leading-relaxed text-[var(--text-secondary)] md:text-xl">
              Kalender-Sync, die deine Daten nicht zerstört.{" "}
              <span className="text-[var(--text-tertiary)]">
                Google, Outlook und Proton — alles auf einen Blick.
              </span>
            </p>
            <div className="flex flex-col items-center gap-3 md:items-start">
              <Link
                href="/auth/signup"
                className="inline-flex rounded-xl bg-[var(--color-rose-700)] px-8 py-3.5 font-[family-name:var(--font-dm-sans)] text-base font-medium text-white shadow-md transition-all hover:scale-[1.02] hover:bg-[var(--color-rose-800)] hover:shadow-lg"
              >
                Kostenlos testen
              </Link>
              <p className="font-[family-name:var(--font-dm-sans)] text-sm text-[var(--text-tertiary)]">
                14 Tage kostenlos. Keine Kreditkarte nötig.
              </p>
            </div>
          </div>

          {/* Visual — right 40%: abstract calendar sync illustration */}
          <div className="flex w-full items-center justify-center md:w-[40%]">
            <div className="relative">
              {/* Three calendar icons converging */}
              <svg width="320" height="280" viewBox="0 0 320 280" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[320px]">
                {/* Google calendar */}
                <rect x="20" y="20" width="72" height="72" rx="16" fill="#4285F4" opacity="0.9" />
                <rect x="32" y="38" width="48" height="4" rx="2" fill="white" opacity="0.8" />
                <rect x="32" y="48" width="36" height="4" rx="2" fill="white" opacity="0.6" />
                <rect x="32" y="58" width="42" height="4" rx="2" fill="white" opacity="0.6" />
                <rect x="32" y="68" width="28" height="4" rx="2" fill="white" opacity="0.4" />
                <text x="56" y="34" textAnchor="middle" fill="white" fontSize="10" fontWeight="600" fontFamily="var(--font-dm-sans)">Google</text>

                {/* Outlook calendar */}
                <rect x="230" y="20" width="72" height="72" rx="16" fill="#0078D4" opacity="0.9" />
                <rect x="242" y="38" width="48" height="4" rx="2" fill="white" opacity="0.8" />
                <rect x="242" y="48" width="36" height="4" rx="2" fill="white" opacity="0.6" />
                <rect x="242" y="58" width="42" height="4" rx="2" fill="white" opacity="0.6" />
                <rect x="242" y="68" width="28" height="4" rx="2" fill="white" opacity="0.4" />
                <text x="266" y="34" textAnchor="middle" fill="white" fontSize="10" fontWeight="600" fontFamily="var(--font-dm-sans)">Outlook</text>

                {/* Proton calendar */}
                <rect x="125" y="0" width="72" height="72" rx="16" fill="#6D4AFF" opacity="0.9" />
                <rect x="137" y="18" width="48" height="4" rx="2" fill="white" opacity="0.8" />
                <rect x="137" y="28" width="36" height="4" rx="2" fill="white" opacity="0.6" />
                <rect x="137" y="38" width="42" height="4" rx="2" fill="white" opacity="0.6" />
                <rect x="137" y="48" width="28" height="4" rx="2" fill="white" opacity="0.4" />
                <text x="161" y="14" textAnchor="middle" fill="white" fontSize="10" fontWeight="600" fontFamily="var(--font-dm-sans)">Proton</text>

                {/* Sync arrows */}
                <path d="M92 56 L125 56" stroke="var(--color-rose-300)" strokeWidth="2" strokeDasharray="4 4" />
                <path d="M197 56 L230 56" stroke="var(--color-rose-300)" strokeWidth="2" strokeDasharray="4 4" />
                <path d="M56 92 L140 140" stroke="var(--color-rose-300)" strokeWidth="2" strokeDasharray="4 4" />
                <path d="M266 92 L180 140" stroke="var(--color-rose-300)" strokeWidth="2" strokeDasharray="4 4" />
                <path d="M161 72 L161 140" stroke="var(--color-rose-300)" strokeWidth="2" strokeDasharray="4 4" />

                {/* Unified calendar — the Mein Kalender icon */}
                <rect x="110" y="140" width="100" height="100" rx="20" fill="var(--color-rose-700)" />
                <rect x="124" y="162" width="72" height="4" rx="2" fill="white" opacity="0.9" />
                <rect x="124" y="174" width="56" height="4" rx="2" fill="white" opacity="0.7" />
                <rect x="124" y="186" width="64" height="4" rx="2" fill="white" opacity="0.7" />
                <rect x="124" y="198" width="40" height="4" rx="2" fill="white" opacity="0.5" />
                <rect x="124" y="210" width="52" height="4" rx="2" fill="white" opacity="0.5" />
                <text x="160" y="156" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="var(--font-satoshi)">Mein Kalender</text>

                {/* Green sync indicator */}
                <circle cx="200" y="150" r="8" fill="#059669" />
                <path d="M196 150 L199 153 L204 147" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-[1120px] px-6">
          <div className="flex flex-col items-center gap-12 md:flex-row md:gap-16">
            <div className="flex flex-col gap-4 md:w-1/2">
              <h2 className="font-[family-name:var(--font-satoshi)] text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)] md:text-[28px]">
                Du siehst sofort, ob alles funktioniert.
              </h2>
              <p className="font-[family-name:var(--font-dm-sans)] text-base leading-relaxed text-[var(--text-secondary)]">
                Kein anderes Tool zeigt dir die Gesundheit deiner Synchronisierung.
                Events synchronisiert, Integrität geprüft, Provider-Status auf einen Blick.
              </p>
            </div>
            {/* Dashboard mockup card */}
            <div className="w-full md:w-1/2">
              <div className="rounded-2xl border border-[var(--border-default)] bg-white p-6 shadow-lg">
                <div className="mb-4 font-[family-name:var(--font-satoshi)] text-sm font-medium text-[var(--text-tertiary)]">
                  SYNC-COCKPIT
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl bg-[var(--bg-secondary)] p-4">
                    <div className="font-[family-name:var(--font-satoshi)] text-2xl font-bold text-[var(--text-primary)]">247</div>
                    <div className="font-[family-name:var(--font-dm-sans)] text-xs text-[var(--text-tertiary)]">Events synchronisiert</div>
                  </div>
                  <div className="rounded-xl bg-[var(--bg-secondary)] p-4">
                    <div className="font-[family-name:var(--font-satoshi)] text-2xl font-bold text-[#059669]">99.9%</div>
                    <div className="font-[family-name:var(--font-dm-sans)] text-xs text-[var(--text-tertiary)]">Integrität</div>
                  </div>
                  <div className="rounded-xl bg-[var(--bg-secondary)] p-4">
                    <div className="font-[family-name:var(--font-satoshi)] text-2xl font-bold text-[var(--text-primary)]">3</div>
                    <div className="font-[family-name:var(--font-dm-sans)] text-xs text-[var(--text-tertiary)]">Provider verbunden</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-[#059669]" />
                    <span className="font-[family-name:var(--font-dm-sans)] text-xs text-[var(--text-tertiary)]">Google</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-[#059669]" />
                    <span className="font-[family-name:var(--font-dm-sans)] text-xs text-[var(--text-tertiary)]">Outlook</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-[#059669]" />
                    <span className="font-[family-name:var(--font-dm-sans)] text-xs text-[var(--text-tertiary)]">Proton</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-28">
        <div className="mx-auto max-w-[1120px] px-6">
          <div className="flex flex-col gap-20 md:gap-28">
            {/* Feature 1: Multi-branded booking pages */}
            <div className="flex flex-col items-center gap-10 md:flex-row md:gap-16">
              <div className="flex flex-col gap-4 md:w-1/2">
                <h2 className="font-[family-name:var(--font-satoshi)] text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)] md:text-[22px]">
                  Drei Firmen. Drei Buchungsseiten. Ein Tool.
                </h2>
                <p className="font-[family-name:var(--font-dm-sans)] text-base leading-relaxed text-[var(--text-secondary)]">
                  Jede Buchungsseite mit eigenem Branding. Dein Beratungsmandat sieht anders aus als dein Board-Sitz.
                </p>
              </div>
              <div className="flex w-full justify-center md:w-1/2">
                {/* Three fanned booking page cards */}
                <div className="relative h-48 w-64">
                  <div className="absolute left-0 top-4 h-40 w-48 rotate-[-6deg] rounded-xl border border-[var(--border-default)] bg-white p-3 shadow-md">
                    <div className="h-2 w-16 rounded-full bg-[#4285F4]" />
                    <div className="mt-3 h-2 w-24 rounded-full bg-[var(--bg-tertiary)]" />
                    <div className="mt-2 h-2 w-20 rounded-full bg-[var(--bg-tertiary)]" />
                  </div>
                  <div className="absolute left-6 top-2 h-40 w-48 rotate-[-2deg] rounded-xl border border-[var(--border-default)] bg-white p-3 shadow-md">
                    <div className="h-2 w-16 rounded-full bg-[#059669]" />
                    <div className="mt-3 h-2 w-24 rounded-full bg-[var(--bg-tertiary)]" />
                    <div className="mt-2 h-2 w-20 rounded-full bg-[var(--bg-tertiary)]" />
                  </div>
                  <div className="absolute left-12 top-0 h-40 w-48 rotate-[2deg] rounded-xl border border-[var(--border-default)] bg-white p-3 shadow-lg">
                    <div className="h-2 w-16 rounded-full bg-[var(--color-rose-700)]" />
                    <div className="mt-3 h-2 w-24 rounded-full bg-[var(--bg-tertiary)]" />
                    <div className="mt-2 h-2 w-20 rounded-full bg-[var(--bg-tertiary)]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2: Multi-provider sync */}
            <div className="flex flex-col items-center gap-10 md:flex-row-reverse md:gap-16">
              <div className="flex flex-col gap-4 md:w-1/2">
                <h2 className="font-[family-name:var(--font-satoshi)] text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)] md:text-[22px]">
                  Proton. Outlook. Google. Alles im Blick.
                </h2>
                <p className="font-[family-name:var(--font-dm-sans)] text-base leading-relaxed text-[var(--text-secondary)]">
                  Google und Outlook voll synchronisiert. Proton Calendar als Leseansicht integriert — Schreib-Sync kommt bald.
                </p>
              </div>
              <div className="flex w-full items-center justify-center gap-6 md:w-1/2">
                {/* Provider logos with sync arrows */}
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#4285F4] text-xs font-bold text-white shadow-sm">G</div>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12H19M19 12L14 7M19 12L14 17" stroke="var(--color-rose-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#0078D4] text-xs font-bold text-white shadow-sm">O</div>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12H19M19 12L14 7M19 12L14 17" stroke="var(--color-rose-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#6D4AFF] text-xs font-bold text-white shadow-sm">P</div>
                </div>
              </div>
            </div>

            {/* Feature 3: Conflict detection */}
            <div className="flex flex-col items-center gap-10 md:flex-row md:gap-16">
              <div className="flex flex-col gap-4 md:w-1/2">
                <h2 className="font-[family-name:var(--font-satoshi)] text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)] md:text-[22px]">
                  Überschneidungen sofort erkennen.
                </h2>
                <p className="font-[family-name:var(--font-dm-sans)] text-base leading-relaxed text-[var(--text-secondary)]">
                  Board Meeting um 14 Uhr bei Firma A, Kundencall um 14 Uhr bei Firma B?
                  Wir sagen dir Bescheid.
                </p>
              </div>
              <div className="flex w-full justify-center md:w-1/2">
                {/* Conflict banner mockup */}
                <div className="w-full max-w-xs rounded-xl border border-[var(--color-amber-200)] bg-[var(--color-amber-50)] p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-lg">&#9888;</span>
                    <div>
                      <div className="font-[family-name:var(--font-dm-sans)] text-sm font-medium text-[var(--color-amber-800)]">
                        Terminüberschneidung erkannt
                      </div>
                      <div className="mt-1 font-[family-name:var(--font-dm-sans)] text-xs text-[var(--color-amber-700)]">
                        Board Meeting (Outlook) und Kundencall (Google)
                        <br />
                        Morgen, 14:00 — 15:00
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="preise" className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-[1120px] px-6">
          <div className="flex flex-col items-center">
            <h2 className="font-[family-name:var(--font-satoshi)] text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)] md:text-[28px]">
              Ein Plan. Alles drin.
            </h2>
            <div className="mt-10 w-full max-w-md rounded-2xl border border-[var(--border-default)] bg-white p-8 shadow-lg">
              <div className="flex items-baseline justify-center gap-1">
                <span className="font-[family-name:var(--font-satoshi)] text-[52px] font-bold tracking-[-0.04em] text-[var(--text-primary)]">
                  19&thinsp;&euro;
                </span>
                <span className="font-[family-name:var(--font-dm-sans)] text-lg text-[var(--text-tertiary)]">
                  /Monat
                </span>
              </div>
              <ul className="mt-8 flex flex-col gap-3">
                {[
                  "Multi-Kalender-Sync",
                  "Gebrandete Buchungsseiten",
                  "Sync-Cockpit",
                  "Proton Calendar (Leseansicht)",
                  "Überschneidungs-Erkennung",
                  "Unbegrenzte Kalender",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-3 font-[family-name:var(--font-dm-sans)] text-base text-[var(--text-primary)]">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
                      <path d="M6 10L9 13L14 7" stroke="var(--color-rose-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup"
                className="mt-8 flex w-full items-center justify-center rounded-xl bg-[var(--color-rose-700)] py-3.5 font-[family-name:var(--font-dm-sans)] text-base font-medium text-white shadow-md transition-all hover:scale-[1.02] hover:bg-[var(--color-rose-800)] hover:shadow-lg"
              >
                Kostenlos testen
              </Link>
              <p className="mt-3 text-center font-[family-name:var(--font-dm-sans)] text-sm text-[var(--text-tertiary)]">
                14 Tage kostenlos. Keine Kreditkarte nötig.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-[var(--color-stone-900,#1C1917)] py-16 md:py-20">
        <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-6 px-6 text-center">
          <h2 className="font-[family-name:var(--font-satoshi)] text-2xl font-bold tracking-[-0.03em] text-white md:text-[28px]">
            Schluss mit Kalender-Chaos.
          </h2>
          <Link
            href="/auth/signup"
            className="inline-flex rounded-xl bg-white px-8 py-3.5 font-[family-name:var(--font-dm-sans)] text-base font-medium text-[var(--color-rose-700)] shadow-md transition-all hover:scale-[1.02] hover:shadow-lg"
          >
            Jetzt starten
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[var(--color-stone-900,#1C1917)] border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-[1120px] flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <img src="/logo-horizontal.svg" alt="mein-kalender.link" className="h-6 brightness-0 invert" />
          <div className="flex gap-6 font-[family-name:var(--font-dm-sans)] text-sm text-stone-400">
            <a href="#" className="transition-colors hover:text-stone-300">Impressum</a>
            <a href="#" className="transition-colors hover:text-stone-300">Datenschutz</a>
            <a href="mailto:kontakt@mein-kalender.link" className="transition-colors hover:text-stone-300">Kontakt</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
