import { describe, it, expect } from "vitest";
import { foldLine, escapeIcs, formatIcsDate } from "./ics-utils";

function physicalLines(folded: string): string[] {
  return folded.split("\r\n");
}

describe("foldLine", () => {
  it("leaves short lines untouched", () => {
    expect(foldLine("SUMMARY:kurz")).toBe("SUMMARY:kurz");
  });

  it("keeps every physical line within 75 octets", () => {
    const inputs = [
      "DESCRIPTION:" + "a".repeat(300),
      "DESCRIPTION:" + "ä".repeat(300),
      "DESCRIPTION:Leipzig wächst und mit der Stadt wächst ein Netzwerk aus Pionieren, das die Region trägt",
      "SUMMARY:" + "😀".repeat(60),
    ];
    for (const input of inputs) {
      for (const line of physicalLines(foldLine(input))) {
        expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
      }
    }
  });

  it("does not split a multi-byte character across the fold", () => {
    const folded = foldLine("DESCRIPTION:" + "ä".repeat(200));
    for (const line of physicalLines(folded)) {
      // A round-trip through Buffer loses nothing only if no surrogate or
      // UTF-8 sequence was cut in half.
      expect(Buffer.from(line, "utf8").toString("utf8")).toBe(line);
      expect(line).not.toContain("�");
    }
  });

  it("prefixes continuation lines with exactly one space and unfolds losslessly", () => {
    const input = "DESCRIPTION:Ein längerer Text mit Umlauten äöü und genug Länge, damit gefaltet wird — mehrfach sogar.";
    const lines = physicalLines(foldLine(input));
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines.slice(1)) {
      expect(line.startsWith(" ")).toBe(true);
      expect(line.startsWith("  ")).toBe(false);
    }
    const unfolded = lines[0] + lines.slice(1).map((l) => l.slice(1)).join("");
    expect(unfolded).toBe(input);
  });

  it("folds a line that is exactly at the limit only when it exceeds it", () => {
    const exactly75 = "X".repeat(75);
    expect(physicalLines(foldLine(exactly75))).toHaveLength(1);
    expect(physicalLines(foldLine("X".repeat(76)))).toHaveLength(2);
  });
});

describe("escapeIcs", () => {
  it("escapes the RFC 5545 special characters", () => {
    expect(escapeIcs("a,b;c\\d")).toBe("a\\,b\\;c\\\\d");
  });

  it("turns line breaks into literal \\n, including CRLF from Outlook", () => {
    expect(escapeIcs("a\r\nb\nc\rd")).toBe("a\\nb\\nc\\nd");
  });

  it("never leaves a bare CR in the value", () => {
    expect(escapeIcs("Zeile 1\r\nZeile 2")).not.toContain("\r");
  });
});

describe("formatIcsDate", () => {
  it("emits a UTC timestamp without separators", () => {
    expect(formatIcsDate(new Date("2026-08-20T13:00:00.000Z"))).toBe("20260820T130000Z");
  });
});
