/**
 * Erkennt Termine, die Reclaim.ai in den Kalender schreibt.
 *
 * Zwei Merkmale, weil keines allein reicht:
 *
 *  - Der Link auf reclaim.ai in der Beschreibung. Trägt fast jeder
 *    Reclaim-Termin, aber nicht alle: Gewohnheiten wie "🍱 Lunch" kommen ohne
 *    Beschreibung an.
 *  - Das Emoji am Titelanfang. Reclaim stellt 🛡 (verteidigt) oder 🆓 (frei
 *    verschiebbar) voran. Fängt die Gewohnheiten ohne Beschreibung, fehlt
 *    aber bei einem Teil der eingeplanten Aufgaben.
 *
 * Bauformen der Beschreibung:
 *   Eigenblöcke   "<i>This AI-powered event was created by <a href=".../reclaim.ai/...">…"
 *   Aufgaben      "<p>~~~~~~~~~~</p><i>This event was created by <a href=".../reclaim.ai/...">…"
 *
 * Die Unterscheidung hängt an "AI-powered"; ohne Beschreibung entscheidet der
 * Titel-Marker, und dann gilt der Termin als Eigenblock, weil eingeplante
 * Aufgaben in den geprüften Daten immer eine Beschreibung tragen.
 *
 * Geprüft an 630 Terminen eines Produktionskontos (Stand 2026-08-31). Reclaims
 * Formulierungen und Emojis sind nicht dokumentiert und können sich ändern.
 */

export interface ReclaimBookingFilters {
  ignoreReclaimTasks: boolean;
  ignoreReclaimHabits: boolean;
}

export interface ReclaimEventFields {
  title?: string | null;
  description?: string | null;
}

const SCHILD = 0x1f6e1; // 🛡
const FREI = 0x1f193; // 🆓
const VARIANTENWAHL = 0xfe0f; // die optionale Emoji-Variante hinter dem Schild

function hatTitelMarker(title: string | null | undefined): boolean {
  if (!title) return false;
  const erstes = title.trim().codePointAt(0);
  if (erstes === SCHILD || erstes === FREI) return true;
  return erstes === VARIANTENWAHL;
}

function hatBeschreibungsMarker(description: string | null | undefined): boolean {
  return !!description && description.toLowerCase().includes("reclaim.ai");
}

export function isReclaimEvent(event: ReclaimEventFields): boolean {
  return hatBeschreibungsMarker(event.description) || hatTitelMarker(event.title);
}

/** Gewohnheiten und Smart Meetings — von Reclaim selbst erzeugte Blöcke. */
export function isReclaimHabit(event: ReclaimEventFields): boolean {
  if (!isReclaimEvent(event)) return false;
  if (hatBeschreibungsMarker(event.description)) {
    return event.description!.toLowerCase().includes("ai-powered");
  }
  return true;
}

/** Von Reclaim eingeplante Aufgaben. */
export function isReclaimTask(event: ReclaimEventFields): boolean {
  return isReclaimEvent(event) && !isReclaimHabit(event);
}

/**
 * Soll dieser Termin bei der Slot-Berechnung der Buchungsseiten übergangen
 * werden? Ohne gesetzte Schalter blockiert Reclaim wie jeder andere Termin.
 */
export function isIgnoredForBooking(event: ReclaimEventFields, filters: ReclaimBookingFilters): boolean {
  if (!isReclaimEvent(event)) return false;
  return isReclaimHabit(event) ? filters.ignoreReclaimHabits : filters.ignoreReclaimTasks;
}
