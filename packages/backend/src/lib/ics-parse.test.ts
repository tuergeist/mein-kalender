import { describe, it, expect } from "vitest";
import { parseIcs, parseIcsDateValue } from "./ics-parse";

function vcal(...events: string[]): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");
}

// Shape of an event as served by calendar.proton.me (Outlook/Teams invitation).
const PROTON_EVENT = [
  "BEGIN:VEVENT",
  "UID:040000008200E00074C5B7101A82E008000000",
  " 00004CD7C9C36ADD01",
  "DTSTART;TZID=Europe/Berlin:20261106T110000",
  "DTEND;TZID=Europe/Berlin:20261106T113000",
  "SEQUENCE:0",
  "STATUS:CONFIRMED",
  "SUMMARY;LANGUAGE=de-DE:HeyKurt <> ASA",
  "DESCRIPTION;LANGUAGE=de-DE:Was die Schnittstelle machen soll\\nGästefragen\\, Upsel",
  " l\\; Storno",
  "LOCATION;LANGUAGE=de-DE:Microsoft Teams-Besprechung",
  "END:VEVENT",
].join("\r\n");

describe("parseIcs", () => {
  it("reads properties that carry parameters", () => {
    const [ev] = parseIcs(vcal(PROTON_EVENT));
    expect(ev.summary).toBe("HeyKurt <> ASA");
    expect(ev.location).toBe("Microsoft Teams-Besprechung");
  });

  it("unescapes text and joins folded lines", () => {
    const [ev] = parseIcs(vcal(PROTON_EVENT));
    expect(ev.uid).toBe("040000008200E00074C5B7101A82E00800000000004CD7C9C36ADD01");
    expect(ev.description).toBe("Was die Schnittstelle machen soll\nGästefragen, Upsell; Storno");
  });

  it("converts a TZID time to UTC (winter, CET = UTC+1)", () => {
    const [ev] = parseIcs(vcal(PROTON_EVENT));
    expect(ev.dtStart.toISOString()).toBe("2026-11-06T10:00:00.000Z");
    expect(ev.dtEnd.toISOString()).toBe("2026-11-06T10:30:00.000Z");
    expect(ev.allDay).toBe(false);
  });

  it("converts a TZID time to UTC (summer, CEST = UTC+2)", () => {
    expect(parseIcsDateValue("20260715T090000", "Europe/Berlin").toISOString()).toBe("2026-07-15T07:00:00.000Z");
  });

  it("handles the DST switch day on both sides", () => {
    expect(parseIcsDateValue("20260329T013000", "Europe/Berlin").toISOString()).toBe("2026-03-29T00:30:00.000Z");
    expect(parseIcsDateValue("20260329T033000", "Europe/Berlin").toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });

  it("keeps UTC times as they are", () => {
    expect(parseIcsDateValue("20261106T100000Z", "Europe/Berlin").toISOString()).toBe("2026-11-06T10:00:00.000Z");
  });

  it("falls back to UTC for floating times and unknown zones", () => {
    expect(parseIcsDateValue("20261106T110000").toISOString()).toBe("2026-11-06T11:00:00.000Z");
    expect(parseIcsDateValue("20261106T110000", "Not/AZone").toISOString()).toBe("2026-11-06T11:00:00.000Z");
  });

  it("recognises all-day events by VALUE=DATE and by an 8-digit date", () => {
    const ev = [
      "BEGIN:VEVENT",
      "UID:a",
      "DTSTART;VALUE=DATE:20261106",
      "DTEND;VALUE=DATE:20261107",
      "SUMMARY:Ganztags",
      "END:VEVENT",
    ].join("\r\n");
    const [parsed] = parseIcs(vcal(ev));
    expect(parsed.allDay).toBe(true);
    expect(parsed.dtStart.toISOString()).toBe("2026-11-06T00:00:00.000Z");
  });

  it("ignores properties of a nested VALARM", () => {
    const ev = [
      "BEGIN:VEVENT",
      "UID:a",
      "DTSTART:20261106T100000Z",
      "SUMMARY:Echter Titel",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Erinnerung",
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n");
    const [parsed] = parseIcs(vcal(ev));
    expect(parsed.summary).toBe("Echter Titel");
    expect(parsed.description).toBeNull();
  });

  it("does not take a colon inside a quoted parameter for the value separator", () => {
    const ev = [
      "BEGIN:VEVENT",
      "UID:a",
      "DTSTART:20261106T100000Z",
      'SUMMARY;ALTREP="cid:part1":Titel',
      "END:VEVENT",
    ].join("\r\n");
    expect(parseIcs(vcal(ev))[0].summary).toBe("Titel");
  });

  it("falls back to '(No title)', skips events without UID or DTSTART, and accepts LF line endings", () => {
    const noTitle = ["BEGIN:VEVENT", "UID:a", "DTSTART:20261106T100000Z", "END:VEVENT"].join("\n");
    const noUid = ["BEGIN:VEVENT", "DTSTART:20261106T100000Z", "END:VEVENT"].join("\n");
    const noStart = ["BEGIN:VEVENT", "UID:b", "END:VEVENT"].join("\n");
    const events = parseIcs(["BEGIN:VCALENDAR", noTitle, noUid, noStart, "END:VCALENDAR"].join("\n"));
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("(No title)");
    expect(events[0].dtEnd).toEqual(events[0].dtStart);
  });
});
