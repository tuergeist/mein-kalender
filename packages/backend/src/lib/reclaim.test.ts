import { describe, it, expect } from "vitest";
import { isReclaimEvent, isReclaimHabit, isReclaimTask, isIgnoredForBooking } from "./reclaim";

// Gekürzte Beschreibungen, wie sie in der Produktionsdatenbank stehen.
const HABIT =
  '<i>This AI-powered event was created by <a href="https://reclaim.ai/r/uf/DlnbX/877223">Reclaim</a></i>';
const TASK =
  'https://app.todoist.com/app/task/6g5X4FvjVHpxj28V\n<p>~~~~~~~~~~</p><i>This event was created by <a href="https://reclaim.ai/r/uf/DlnbX/877223">Reclaim</a></i>';

const AUS = { ignoreReclaimTasks: false, ignoreReclaimHabits: false };

describe("Reclaim-Erkennung", () => {
  it("erkennt beide Bauformen am Link", () => {
    expect(isReclaimEvent(HABIT)).toBe(true);
    expect(isReclaimEvent(TASK)).toBe(true);
  });

  it("unterscheidet Eigenblöcke von Aufgaben", () => {
    expect(isReclaimHabit(HABIT)).toBe(true);
    expect(isReclaimTask(HABIT)).toBe(false);
    expect(isReclaimTask(TASK)).toBe(true);
    expect(isReclaimHabit(TASK)).toBe(false);
  });

  it("greift nicht bei fremden Terminen", () => {
    expect(isReclaimEvent(null)).toBe(false);
    expect(isReclaimEvent(undefined)).toBe(false);
    expect(isReclaimEvent("")).toBe(false);
    expect(isReclaimEvent("Vorbereitung Reclaim-Angebot")).toBe(false);
    expect(isReclaimEvent("https://app.todoist.com/app/task/123")).toBe(false);
  });

  it("blockiert unverändert, solange kein Schalter gesetzt ist", () => {
    expect(isIgnoredForBooking(HABIT, AUS)).toBe(false);
    expect(isIgnoredForBooking(TASK, AUS)).toBe(false);
  });

  it("übergeht nur die eingeschaltete Art", () => {
    const nurAufgaben = { ignoreReclaimTasks: true, ignoreReclaimHabits: false };
    expect(isIgnoredForBooking(TASK, nurAufgaben)).toBe(true);
    expect(isIgnoredForBooking(HABIT, nurAufgaben)).toBe(false);

    const nurBloecke = { ignoreReclaimTasks: false, ignoreReclaimHabits: true };
    expect(isIgnoredForBooking(HABIT, nurBloecke)).toBe(true);
    expect(isIgnoredForBooking(TASK, nurBloecke)).toBe(false);
  });

  it("lässt fremde Termine auch bei beiden Schaltern in Ruhe", () => {
    const beide = { ignoreReclaimTasks: true, ignoreReclaimHabits: true };
    expect(isIgnoredForBooking("Kundentermin", beide)).toBe(false);
    expect(isIgnoredForBooking(null, beide)).toBe(false);
  });
});
