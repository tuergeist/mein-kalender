# Kalender-Sync Spezifikation

## Überblick

Das Sync-System kopiert Termine aus Quellkalendern in Zielkalender. Jeder User kann mehrere Sync-Ziele konfigurieren. Cross-Syncing ist explizit erlaubt: Kalender A kann Ziel in Kontext 1 und Quelle in Kontext 2 sein.

## Konzepte

### Quellkalender (Source)
Ein verbundener Kalender (Google, Outlook, Proton, ICS) aus dem Termine gelesen werden. Jeder Quellkalender wird periodisch abgerufen (Default: alle 10 Minuten).

### Zielkalender (Target)
Ein beschreibbarer Kalender in den Termine kopiert werden. Ein Kalender wird zum Ziel über die Sync-Konfiguration. Jedes Ziel hat:
- **Quellkalender**: Welche Kalender als Quelle dienen (Default: alle Non-Self)
- **Sync-Modus**: `full` (Titel + Details) oder `blocked` (nur "[Sync] Busy")
- **Sync-Zeitraum**: Wie weit in die Zukunft (30/60/90 Tage)
- **Filter**: Welche Termine übersprungen werden

### Mapping
Jeder kopierte Termin wird in `TargetEventMapping` vermerkt. Das verhindert Doppelkopien und ermöglicht Updates und Löschungen.

## Cross-Sync Regeln

### Erlaubt
- Kalender A → Ziel B UND Kalender B → Ziel A (bidirektional)
- Kalender A → Ziel B UND Kalender A → Ziel C (ein-zu-viele)
- Kalender A + C → Ziel B (viele-zu-eins)

### Loop Prevention
Ein kopierter Termin darf nicht erneut kopiert werden. Das wird über drei Mechanismen sichergestellt:

1. **Titel-Prefix**: Kopierte Termine beginnen mit `[Sync]`. Events mit diesem Prefix werden bei der Quell-Abfrage übersprungen.
2. **Mapping-Check**: Events die bereits ein Mapping zum aktuellen Ziel haben werden übersprungen (`sourceMappings: { none: { targetCalendarEntryId } }`).
3. **Self-Exclusion**: Der Zielkalender selbst wird als Quelle ausgeschlossen (nicht alle Targets, nur der aktuelle).

### Deduplication
Wenn dasselbe Event in mehreren Quellkalendern erscheint (z.B. geteilter Kalender), wird es über einen Fingerprint (Titel + Start + Ende) dedupliziert. Nur ein Termin wird im Ziel erstellt, weitere Quellen werden auf dasselbe Mapping verwiesen.

## Filter

Jedes Sync-Ziel hat konfigurierbare Filter:

| Filter | Default | Beschreibung |
|--------|---------|-------------|
| `skipWorkLocation` | true | Google "Arbeitsort"-Events überspringen |
| `skipSingleDayAllDay` | false | Eintägige Ganztags-Events überspringen |
| `skipDeclined` | true | Abgelehnte Einladungen überspringen |
| `skipFree` | false | Events mit Status "frei"/"vorläufig"/"transparent" überspringen |

Filter werden **nach** dem DB-Query angewendet (in-memory). Die Filter-Entscheidung basiert auf `providerMetadata`:
- `eventType === "workingLocation"` → skipWorkLocation
- `responseStatus === "declined"` → skipDeclined
- `showAs in ["free", "tentative"]` oder `transparency === "transparent"` → skipFree

## Datenfluss

```
Quellkalender (Provider)
    ↓ Delta-Sync (alle 10 min)
Events-Tabelle (DB)
    ↓ Target-Sync Queue (Concurrency 1)
Für jedes Sync-Ziel:
    1. Orphan Cleanup (gelöschte Quell-Events → Ziel-Events löschen)
    2. Unmapped Events finden (Quellen - Self - bereits Mappings)
    3. Filter anwenden (skip*)
    4. Dedup via Fingerprint
    5. Neue Events im Ziel erstellen, Mapping speichern
    6. Bestehende Mappings updaten (wenn Quell-Event geändert)
    ↓
Zielkalender (Provider)
```

## Queue-Architektur

| Queue | Concurrency | Trigger |
|-------|-------------|---------|
| `calendar-sync` | 5 | Scheduled (alle syncInterval Sekunden) |
| `target-sync` | 1 | Nach jedem Source-Sync |
| `conflict-detection` | 3 | Nach jedem Source-Sync |

Target-Sync läuft mit Concurrency 1 um Race Conditions bei gleichzeitigen Quell-Syncs zu vermeiden.

## Kopierte Termine

### Titel-Format
- **Full-Modus**: `[Sync] {Original-Titel}`
- **Blocked-Modus**: `[Sync] Busy`

### Felder
- **Full**: Titel, Beschreibung, Ort, Start, Ende, Ganztägig
- **Blocked**: Nur "[Sync] Busy", keine Details, Start, Ende, Ganztägig

### Updates
Wenn ein Quell-Event geändert wird (`updatedAt > lastSyncedAt`), wird das Ziel-Event aktualisiert. Updates werden in Batches von 5 verarbeitet.

### Löschungen
Wenn ein Quell-Event gelöscht wird:
1. Sofort: Über Delta-Sync werden Ziel-Events gelöscht und Mappings entfernt
2. Nachträglich: Orphan Cleanup findet Mappings deren Quell-Events fehlen

## Bekannte Einschränkungen

1. **Fingerprint-Kollision**: Zwei verschiedene Events mit identischem Titel + Start + Ende werden als Duplikat behandelt
2. **Titel-basierte Loop Prevention**: Wenn ein User den `[Sync]`-Prefix manuell entfernt, kann ein Loop entstehen
3. **Filter nur auf providerMetadata**: Wenn ein Provider bestimmte Metadaten nicht liefert, greifen die Filter nicht
4. **Kein Retry bei Event-Erstellung**: Wenn ein einzelnes Event nicht erstellt werden kann, wird es beim nächsten Sync-Zyklus erneut versucht (kein explizites Retry)

## API-Endpunkte

### Multi-Target (empfohlen)
- `GET /api/sync-targets` — Alle Sync-Ziele auflisten
- `POST /api/sync-targets` — Neues Sync-Ziel erstellen
- `PUT /api/sync-targets/:id` — Sync-Ziel bearbeiten
- `DELETE /api/sync-targets/:id?deleteSyncedEvents=true|false` — Sync-Ziel entfernen

### Legacy Single-Target
- `GET /api/target-calendar` — Aktuelles Ziel
- `PUT /api/target-calendar` — Ziel setzen (ersetzt vorheriges)
- `DELETE /api/target-calendar` — Ziel entfernen
- `POST /api/target-calendar/cleanup` — Verwaiste [Sync]-Events aufräumen
