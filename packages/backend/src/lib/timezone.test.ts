import { describe, it, expect } from "vitest";
import { wallTimeToUtc } from "./timezone";

describe("wallTimeToUtc", () => {
  it("rechnet Sommerzeit um (Berlin, UTC+2)", () => {
    expect(wallTimeToUtc("2026-09-01", "09:00", "Europe/Berlin").toISOString()).toBe("2026-09-01T07:00:00.000Z");
    expect(wallTimeToUtc("2026-09-01", "17:00", "Europe/Berlin").toISOString()).toBe("2026-09-01T15:00:00.000Z");
  });

  it("rechnet Winterzeit um (Berlin, UTC+1)", () => {
    expect(wallTimeToUtc("2026-12-01", "09:00", "Europe/Berlin").toISOString()).toBe("2026-12-01T08:00:00.000Z");
  });

  it("stimmt am Tag der Zeitumstellung", () => {
    // 2026-10-25: Berlin stellt um 03:00 auf 02:00 zurueck.
    expect(wallTimeToUtc("2026-10-25", "01:00", "Europe/Berlin").toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(wallTimeToUtc("2026-10-25", "09:00", "Europe/Berlin").toISOString()).toBe("2026-10-25T08:00:00.000Z");
    // 2026-03-29: Berlin stellt um 02:00 auf 03:00 vor.
    expect(wallTimeToUtc("2026-03-29", "09:00", "Europe/Berlin").toISOString()).toBe("2026-03-29T07:00:00.000Z");
  });

  it("lässt UTC unverändert", () => {
    expect(wallTimeToUtc("2026-09-01", "09:00", "UTC").toISOString()).toBe("2026-09-01T09:00:00.000Z");
  });

  it("beherrscht Zonen ohne Sommerzeit und mit halben Stunden", () => {
    expect(wallTimeToUtc("2026-09-01", "09:00", "Asia/Kolkata").toISOString()).toBe("2026-09-01T03:30:00.000Z");
    expect(wallTimeToUtc("2026-09-01", "09:00", "America/New_York").toISOString()).toBe("2026-09-01T13:00:00.000Z");
  });
});
