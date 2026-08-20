export function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function escapeIcs(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Fold a content line per RFC 5545 §3.1: no line longer than 75 octets
 * (excluding CRLF), continuation lines prefixed with a single space.
 *
 * The limit is octets, not characters — an umlaut costs two — and a multi-byte
 * sequence must not be split across the fold, so we measure in UTF-8 bytes and
 * cut on a character boundary.
 */
export function foldLine(line: string): string {
  const MAX = 75;
  const result: string[] = [];
  let current = "";
  let bytes = 0;
  // The leading space of every continuation line counts toward its 75 octets.
  let limit = MAX;

  for (const char of line) {
    const size = Buffer.byteLength(char, "utf8");
    if (bytes + size > limit) {
      result.push(current);
      current = "";
      bytes = 0;
      limit = MAX - 1;
    }
    current += char;
    bytes += size;
  }
  result.push(current);

  return result.map((part, i) => (i === 0 ? part : " " + part)).join("\r\n");
}
