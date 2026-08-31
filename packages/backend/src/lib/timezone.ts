/**
 * Wandelt Wanduhrzeiten in echte Zeitpunkte um.
 *
 * Verfügbarkeitsregeln stehen als "09:00" in der Datenbank und meinen die Zeit
 * am Ort des Nutzers. Ohne Umrechnung wurden sie als UTC gesetzt — bei einem
 * Konto in Europe/Berlin lagen die Buchungszeiten dadurch im Sommer zwei
 * Stunden zu spät.
 *
 * Ohne Bibliothek, weil Node die Zonendaten über Intl schon mitbringt.
 */

/** Versatz der Zone zu UTC in Minuten, für diesen Zeitpunkt (also inkl. Sommerzeit). */
function offsetMinutes(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const alsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return (alsUtc - instant.getTime()) / 60000;
}

/**
 * "2026-09-01" + "09:00" + "Europe/Berlin" -> 2026-09-01T07:00:00Z
 *
 * Zwei Durchgänge, weil der Versatz selbst vom Zeitpunkt abhängt: Der erste
 * Versuch liefert eine Näherung, der zweite korrigiert sie an den beiden Tagen
 * im Jahr, an denen die Uhr umgestellt wird.
 */
export function wallTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const alsWaereEsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  let ergebnis = new Date(alsWaereEsUtc - offsetMinutes(new Date(alsWaereEsUtc), timeZone) * 60000);
  ergebnis = new Date(alsWaereEsUtc - offsetMinutes(ergebnis, timeZone) * 60000);
  return ergebnis;
}
