export function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function escapeIcs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function foldLine(line: string): string {
  const result: string[] = [];
  let remaining = line;
  while (remaining.length > 75) {
    result.push(remaining.slice(0, 75));
    remaining = " " + remaining.slice(75);
  }
  result.push(remaining);
  return result.join("\r\n");
}
