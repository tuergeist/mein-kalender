# TODOS

## Phase 2: Paid Launch

### Mollie Billing — offene Reste
- **Was fehlt:** (1) Zugriffssperre: `GET /api/billing` liefert zwar `isActive` aus Trial + Abo-Status, aber keine andere Route wertet es aus — nach Trial-Ende ohne Abo bleibt alles nutzbar. (2) Read-only-Downgrade bei fehlgeschlagener Abbuchung: Der Webhook schreibt den Mollie-Status nach `subscriptionStatus`, es folgt daraus nichts. (3) Rechnungen: keine Rechnungserzeugung, kein USt-IdNr-Feld.
- **Warum:** Ohne Sperre zahlt niemand freiwillig. Rechnungen mit ausgewiesener USt braucht jeder gewerbliche Kunde.
- **Aufwand:** M
- **Priorität:** P1
- **Stand:** Mollie ist eingebaut — `lib/mollie.ts` (Kunde, 0,01-€-Erstzahlung für das Mandat, Abo, Kündigung), `routes/billing.ts` (Checkout, Webhook mit Idempotenz über `PaymentEvent`, Status, Kündigung), 14 Tage Trial bei der Registrierung (`routes/auth.ts:26`), Trial-Restlaufzeit in Dashboard und Billing-Seite.
- **Preise:** 5,00 EUR/Monat oder 50,00 EUR/Jahr brutto, kein Free-Tier. Ersetzt die früher geplanten 19 EUR/Monat über Stripe.
