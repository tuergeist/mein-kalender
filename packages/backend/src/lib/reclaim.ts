/**
 * Erkennt Termine, die Reclaim.ai in den Kalender schreibt.
 *
 * Reclaim hängt an jede Beschreibung einen Link auf die eigene Domain. Das ist
 * der einzige Bestandteil, den beide Bauformen gemeinsam haben, und damit die
 * Erkennung:
 *
 *   Eigenblöcke (Habits, Smart Meetings)
 *     "<i>This AI-powered event was created by <a href="https://reclaim.ai/r/...">Reclaim</a>"
 *   Aufgaben (aus Todoist, Asana, Jira oder direkt in Reclaim)
 *     "<p>~~~~~~~~~~</p><i>This event was created by <a href="https://reclaim.ai/r/...">…"
 *
 * Die Unterscheidung hängt an "AI-powered": Reclaim setzt das nur bei den
 * selbst erzeugten Blöcken, nicht bei eingeplanten Aufgaben. Geprüft an 56
 * Terminen eines Produktionskontos (Stand 2026-08-31); Reclaims Formulierung
 * ist nicht dokumentiert und kann sich ändern.
 */

export interface ReclaimBookingFilters {
  ignoreReclaimTasks: boolean;
  ignoreReclaimHabits: boolean;
}

export function isReclaimEvent(description: string | null | undefined): boolean {
  return !!description && description.toLowerCase().includes("reclaim.ai");
}

/** Habits und Smart Meetings — von Reclaim selbst erzeugte Blöcke. */
export function isReclaimHabit(description: string | null | undefined): boolean {
  return isReclaimEvent(description) && description!.toLowerCase().includes("ai-powered");
}

/** Von Reclaim eingeplante Aufgaben. */
export function isReclaimTask(description: string | null | undefined): boolean {
  return isReclaimEvent(description) && !isReclaimHabit(description);
}

/**
 * Soll dieser Termin bei der Slot-Berechnung der Buchungsseiten übergangen
 * werden? Ohne gesetzte Schalter blockiert Reclaim wie jeder andere Termin.
 */
export function isIgnoredForBooking(
  description: string | null | undefined,
  filters: ReclaimBookingFilters
): boolean {
  if (!isReclaimEvent(description)) return false;
  return isReclaimHabit(description) ? filters.ignoreReclaimHabits : filters.ignoreReclaimTasks;
}
