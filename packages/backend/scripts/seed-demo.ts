/**
 * Seeds a demo account with plausible data, for screenshots of the real app.
 *
 * Intended for a local stack only — it writes invented events and fake calendar
 * credentials. Refuses to run against anything but a local database.
 *
 *   docker compose exec api npx tsx /app/seed-demo.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const EMAIL = "demo@mein-kalender.link";
const PASSWORD = "demo-screenshots";

/** Monday of the current week, at 00:00 local time. */
function mondayOfThisWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return d;
}

function at(base: Date, dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** [dayOffset, startHour, startMinute, durationMinutes, title, location] */
type Slot = [number, number, number, number, string, string | null];

const GOOGLE: Slot[] = [
  [0, 9, 0, 30, "Wochenstart — Team", "Google Meet"],
  [0, 14, 0, 60, "Kundencall Nordmann GmbH", "Google Meet"],
  [1, 11, 0, 45, "1:1 Lena", null],
  [2, 9, 30, 90, "Produktreview Q3", "Google Meet"],
  [3, 16, 0, 30, "Vertrieb — Pipeline", null],
  [4, 10, 0, 60, "Retrospektive", "Google Meet"],
];

const OUTLOOK: Slot[] = [
  [0, 11, 0, 60, "Board Meeting Fyltura", "Vorstandszimmer"],
  [1, 14, 0, 120, "Strategieworkshop", "Leipzig, Neumarkt 2"],
  [2, 14, 0, 60, "Aufsichtsrat — Vorbesprechung", null],
  [3, 9, 0, 30, "Jour fixe Finanzen", null],
  [4, 13, 30, 45, "Investorengespräch", "Teams"],
];

const PROTON: Slot[] = [
  [1, 8, 0, 45, "Schwimmen", "Sportbad an der Elster"],
  [2, 18, 30, 90, "Elternabend", "Grundschule"],
  [3, 12, 0, 60, "Mittagessen mit Jonas", "Kollektiv"],
  [4, 17, 0, 60, "Frisör", "Hair by Hentschel"],
];

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!/@(postgres|localhost|127\.0\.0\.1)[:/]/.test(dbUrl)) {
    console.error("Refusing to run: DATABASE_URL does not look local.");
    console.error(dbUrl.replace(/:[^:@]*@/, ":***@"));
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 11);

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, displayName: "Christoph Becker", username: "christoph" },
    create: {
      email: EMAIL,
      passwordHash,
      displayName: "Christoph Becker",
      username: "christoph",
      emailVerified: true,
      timezone: "Europe/Berlin",
      brandColor: "#9F1239",
      accentColor: "#D97706",
      trialEndsAt,
    },
  });

  await prisma.event.deleteMany({ where: { calendarEntry: { source: { userId: user.id } } } });
  await prisma.calendarSource.deleteMany({ where: { userId: user.id } });

  // Sync is never meant to run here: the credentials are not real. Pushing
  // nextSyncAfter far out keeps the worker from retrying and filling the log.
  const never = new Date();
  never.setFullYear(never.getFullYear() + 5);

  const week = mondayOfThisWeek();

  const calendars: Array<{ provider: string; label: string; name: string; color: string; readOnly: boolean; isTarget: boolean; slots: Slot[] }> = [
    { provider: "google",  label: "Google",           name: "Arbeit",   color: "#4285F4", readOnly: false, isTarget: true,  slots: GOOGLE },
    { provider: "outlook", label: "Outlook",          name: "Mandate",  color: "#0078D4", readOnly: false, isTarget: false, slots: OUTLOOK },
    { provider: "ics",     label: "Proton Calendar",  name: "Privat",   color: "#6D4AFF", readOnly: true,  isTarget: false, slots: PROTON },
  ];

  let eventCount = 0;
  for (const cal of calendars) {
    const source = await prisma.calendarSource.create({
      data: {
        userId: user.id,
        provider: cal.provider,
        label: cal.label,
        credentials: "demo",
        syncStatus: "ok",
        lastSyncAt: new Date(Date.now() - 4 * 60 * 1000),
        nextSyncAfter: never,
        ...(cal.provider === "ics" ? { icsUrl: "https://calendar.proton.me/api/calendar/v1/url/demo/calendar.ics" } : {}),
      },
    });

    const entry = await prisma.calendarEntry.create({
      data: {
        sourceId: source.id,
        name: cal.name,
        color: cal.color,
        providerCalendarId: `demo-${cal.provider}`,
        isTarget: cal.isTarget,
        readOnly: cal.readOnly,
      },
    });

    for (const [day, hour, minute, minutes, title, location] of cal.slots) {
      const startTime = at(week, day, hour, minute);
      await prisma.event.create({
        data: {
          calendarEntryId: entry.id,
          sourceEventId: `demo-${cal.provider}-${day}-${hour}${minute}`,
          title,
          location,
          startTime,
          endTime: new Date(startTime.getTime() + minutes * 60_000),
        },
      });
      eventCount++;
    }
  }

  await prisma.eventType.deleteMany({ where: { userId: user.id } });
  const eventTypes = [
    { name: "Kennenlernen", slug: "kennenlernen", durationMinutes: 30, color: "#9F1239", description: "Kurzes Gespräch, ob wir zueinander passen." },
    { name: "Beratung", slug: "beratung", durationMinutes: 60, color: "#D97706", description: "Für bestehende Mandate." },
    { name: "Board-Termin", slug: "board", durationMinutes: 90, color: "#0078D4", description: null },
  ];
  for (const et of eventTypes) {
    await prisma.eventType.create({ data: { userId: user.id, ...et, enabled: true } });
  }

  await prisma.availabilityRule.deleteMany({ where: { userId: user.id } });
  for (const dayOfWeek of [1, 2, 3, 4, 5]) {
    await prisma.availabilityRule.create({
      data: { userId: user.id, dayOfWeek, startTime: "09:00", endTime: "17:00", enabled: true },
    });
  }

  console.log(`user        ${EMAIL} / ${PASSWORD}`);
  console.log(`calendars   ${calendars.length}`);
  console.log(`events      ${eventCount} (Woche ab ${week.toISOString().slice(0, 10)})`);
  console.log(`eventTypes  ${eventTypes.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
