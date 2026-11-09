export interface ParsedVEvent {
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  dtStart: Date;
  dtEnd: Date;
  allDay: boolean;
}

interface ContentLine {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** Lines starting with space/tab continue the previous line (RFC 5545 §3.1). */
export function unfoldIcs(data: string): string {
  return data.replace(/\r?\n[ \t]/g, "");
}

/** Reverses the TEXT escaping of RFC 5545 §3.3.11. */
export function unescapeIcsText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));
}

/**
 * Splits `NAME;PARAM=x;PARAM2="a:b":value` into its parts. The value starts at
 * the first colon outside a quoted parameter value.
 */
function parseContentLine(line: string): ContentLine | null {
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ":" && !inQuotes) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;

  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts: string[] = [];
  let current = "";
  inQuotes = false;
  for (const ch of head) {
    if (ch === '"') inQuotes = !inQuotes;
    if (ch === ";" && !inQuotes) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);

  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: parts[0].toUpperCase(), params, value };
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Interprets a wall-clock time in `timeZone` and returns the UTC instant. */
function wallClockToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, timeZone: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = guess - zoneOffsetMs(guess, timeZone);
  // Re-evaluate at the corrected instant so dates near a DST switch come out right.
  return new Date(guess - zoneOffsetMs(first, timeZone));
}

/**
 * Parses DATE and DATE-TIME values. UTC ("…Z") is taken as is, a TZID parameter
 * is honoured, and a floating time or an unknown TZID falls back to UTC.
 */
export function parseIcsDateValue(value: string, tzid?: string): Date {
  const v = value.trim();
  const y = Number(v.slice(0, 4));
  const mo = Number(v.slice(4, 6));
  const d = Number(v.slice(6, 8));
  if (v.length === 8) return new Date(Date.UTC(y, mo - 1, d));

  const h = Number(v.slice(9, 11));
  const mi = Number(v.slice(11, 13));
  const s = Number(v.slice(13, 15)) || 0;
  if (!v.endsWith("Z") && tzid) {
    try {
      return wallClockToUtc(y, mo, d, h, mi, s, tzid);
    } catch {
      // unknown time zone name: fall through to UTC
    }
  }
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
}

export function parseIcs(icsData: string): ParsedVEvent[] {
  const events: ParsedVEvent[] = [];
  const lines = unfoldIcs(icsData).split(/\r?\n/);

  let current: ContentLine[] | null = null;
  let alarmDepth = 0;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = [];
      alarmDepth = 0;
      continue;
    }
    if (!current) continue;

    if (line === "END:VEVENT") {
      const ev = buildEvent(current);
      if (ev) events.push(ev);
      current = null;
      continue;
    }
    // Properties of a nested VALARM must not override those of the event.
    if (line === "BEGIN:VALARM") {
      alarmDepth++;
      continue;
    }
    if (line === "END:VALARM") {
      alarmDepth--;
      continue;
    }
    if (alarmDepth > 0) continue;

    const parsed = parseContentLine(line);
    if (parsed) current.push(parsed);
  }

  return events;
}

function buildEvent(props: ContentLine[]): ParsedVEvent | null {
  const find = (name: string) => props.find((p) => p.name === name);

  const uid = find("UID")?.value.trim();
  const start = find("DTSTART");
  if (!uid || !start) return null;

  const end = find("DTEND");
  const summary = find("SUMMARY")?.value.trim();
  const description = find("DESCRIPTION")?.value.trim();
  const location = find("LOCATION")?.value.trim();

  const dtStart = parseIcsDateValue(start.value, start.params.TZID);
  return {
    uid,
    summary: summary ? unescapeIcsText(summary) : "(No title)",
    description: description ? unescapeIcsText(description) : null,
    location: location ? unescapeIcsText(location) : null,
    dtStart,
    dtEnd: end ? parseIcsDateValue(end.value, end.params.TZID) : dtStart,
    allDay: start.params.VALUE === "DATE" || start.value.trim().length === 8,
  };
}

/**
 * Stored events that a subscribed feed no longer lists. Returns nothing when the
 * feed looks unreliable: no events at all (an empty or broken response must not
 * wipe a calendar) or fewer parsed events than the feed declares (an event our
 * parser skipped would otherwise look deleted).
 */
export function staleIcsEvents<T extends { sourceEventId: string }>(
  stored: T[],
  feedUids: Set<string>,
  parsedCount: number,
  icsData: string
): T[] {
  const declared = (icsData.match(/^BEGIN:VEVENT/gm) ?? []).length;
  if (parsedCount === 0 || parsedCount < declared) return [];
  return stored.filter((ev) => !feedUids.has(ev.sourceEventId));
}
