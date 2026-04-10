import { formatIcsDate, escapeIcs, foldLine } from "./ics-utils";

export function buildIcsInvitation(params: {
  method: "REQUEST" | "CANCEL";
  uid: string;
  sequence: number;
  organizer: { name: string; email: string };
  attendees: Array<{ name: string; email: string }>;
  summary: string;
  description?: string | null;
  location?: string | null;
  dtStart: Date;
  dtEnd: Date;
  status?: "CONFIRMED" | "CANCELLED";
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//mein-kalender//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${params.method}`,
    "BEGIN:VEVENT",
    foldLine(`UID:${params.uid}`),
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(params.dtStart)}`,
    `DTEND:${formatIcsDate(params.dtEnd)}`,
    `SEQUENCE:${params.sequence}`,
    `STATUS:${params.status || "CONFIRMED"}`,
    foldLine(`SUMMARY:${escapeIcs(params.summary)}`),
    foldLine(`ORGANIZER;CN=${escapeIcs(params.organizer.name)}:mailto:${params.organizer.email}`),
  ];
  for (const att of params.attendees) {
    lines.push(foldLine(`ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${escapeIcs(att.name)}:mailto:${att.email}`));
  }
  if (params.description) lines.push(foldLine(`DESCRIPTION:${escapeIcs(params.description)}`));
  if (params.location) lines.push(foldLine(`LOCATION:${escapeIcs(params.location)}`));
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}
