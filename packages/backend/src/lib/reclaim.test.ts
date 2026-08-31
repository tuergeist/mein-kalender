import { describe, it, expect } from "vitest";
import { isReclaimEvent, isReclaimHabit, isReclaimTask, isIgnoredForBooking } from "./reclaim";

// Gekürzte Datensätze, wie sie in der Produktionsdatenbank stehen.
const BLOCK = {
  title: "🛡 Fokuszeit",
  description:
    '<i>This AI-powered event was created by <a href="https://reclaim.ai/r/uf/DlnbX/877223">Reclaim</a></i>',
};
const AUFGABE = {
  title: "🛡 Inbox · Ing Becker USt 25",
  description:
    'https://app.todoist.com/app/task/6g5X4FvjVHpxj28V\n<p>~~~~~~~~~~</p><i>This event was created by <a href="https://reclaim.ai/r/uf/DlnbX/877223">Reclaim</a></i>',
};
const AUFGABE_OHNE_EMOJI = { title: "Inbox · Kunz bezahlen", description: AUFGABE.description };
const LUNCH = { title: "🛡 🍱 Lunch", description: null };
const LUNCH_FREI = { title: "🆓 🍱 Lunch", description: null };
const FREMD = { title: "Kundentermin", description: "Vorbereitung Reclaim-Angebot" };

const AUS = { ignoreReclaimTasks: false, ignoreReclaimHabits: false };

describe("Reclaim-Erkennung", () => {
  it("erkennt am Link in der Beschreibung", () => {
    expect(isReclaimEvent(BLOCK)).toBe(true);
    expect(isReclaimEvent(AUFGABE_OHNE_EMOJI)).toBe(true);
  });

  it("erkennt Gewohnheiten ohne Beschreibung am Titel-Emoji", () => {
    expect(isReclaimEvent(LUNCH)).toBe(true);
    expect(isReclaimEvent(LUNCH_FREI)).toBe(true);
    expect(isReclaimHabit(LUNCH)).toBe(true);
    expect(isReclaimTask(LUNCH)).toBe(false);
  });

  it("unterscheidet Eigenblöcke von Aufgaben über AI-powered", () => {
    expect(isReclaimHabit(BLOCK)).toBe(true);
    expect(isReclaimTask(BLOCK)).toBe(false);
    // Emoji im Titel, aber eine Aufgaben-Beschreibung: die Beschreibung entscheidet.
    expect(isReclaimTask(AUFGABE)).toBe(true);
    expect(isReclaimHabit(AUFGABE)).toBe(false);
  });

  it("greift nicht bei fremden Terminen", () => {
    expect(isReclaimEvent(FREMD)).toBe(false);
    expect(isReclaimEvent({ title: null, description: null })).toBe(false);
    expect(isReclaimEvent({ title: "", description: "" })).toBe(false);
    expect(isReclaimEvent({ title: "🍱 Mittagessen", description: null })).toBe(false);
  });

  it("blockiert unverändert, solange kein Schalter gesetzt ist", () => {
    expect(isIgnoredForBooking(BLOCK, AUS)).toBe(false);
    expect(isIgnoredForBooking(AUFGABE, AUS)).toBe(false);
    expect(isIgnoredForBooking(LUNCH, AUS)).toBe(false);
  });

  it("übergeht nur die eingeschaltete Art", () => {
    const nurAufgaben = { ignoreReclaimTasks: true, ignoreReclaimHabits: false };
    expect(isIgnoredForBooking(AUFGABE, nurAufgaben)).toBe(true);
    expect(isIgnoredForBooking(BLOCK, nurAufgaben)).toBe(false);
    expect(isIgnoredForBooking(LUNCH, nurAufgaben)).toBe(false);

    const nurBloecke = { ignoreReclaimTasks: false, ignoreReclaimHabits: true };
    expect(isIgnoredForBooking(BLOCK, nurBloecke)).toBe(true);
    expect(isIgnoredForBooking(LUNCH, nurBloecke)).toBe(true);
    expect(isIgnoredForBooking(AUFGABE, nurBloecke)).toBe(false);
  });

  it("lässt fremde Termine auch bei beiden Schaltern in Ruhe", () => {
    const beide = { ignoreReclaimTasks: true, ignoreReclaimHabits: true };
    expect(isIgnoredForBooking(FREMD, beide)).toBe(false);
  });
});
