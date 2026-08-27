/**
 * Creates the account the deployment smoke test books against.
 *
 * Booking was broken for four months without anyone noticing, because the
 * health check only proved that the process was alive. The smoke test books a
 * slot for real after every deploy, and this is the account it uses.
 *
 * The account is deliberately inert:
 *  - no password hash, so it cannot be signed in to
 *  - no calendar source, so no event is written anywhere and no invitation mail
 *    is sent — both paths in the booking route are behind `bookingEntry`
 *  - availability around the clock on every weekday, so a free slot exists
 *    regardless of when the deploy runs or which timezone applies
 *
 * Idempotent: running it again updates the same rows.
 *
 *   npx tsx scripts/seed-smoke-user.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMAIL = "smoke@mein-kalender.link";
const USERNAME = "smoketest";
const SLUG = "ping";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { username: USERNAME, displayName: "Smoke Test", timezone: "UTC" },
    create: {
      email: EMAIL,
      username: USERNAME,
      displayName: "Smoke Test",
      timezone: "UTC",
      emailVerified: true,
      role: "user",
    },
  });

  // Not upsert: the unique index is (userId, eventTypeId, dayOfWeek) and
  // eventTypeId is null for user-wide rules. Postgres treats NULL as distinct
  // in a unique index, so the constraint does not hold for these rows and an
  // upsert would insert a duplicate on every run.
  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
    const rule = await prisma.availabilityRule.findFirst({
      where: { userId: user.id, eventTypeId: null, dayOfWeek },
    });
    if (rule) {
      await prisma.availabilityRule.update({
        where: { id: rule.id },
        data: { startTime: "00:00", endTime: "23:45", enabled: true },
      });
    } else {
      await prisma.availabilityRule.create({
        data: { userId: user.id, dayOfWeek, startTime: "00:00", endTime: "23:45", enabled: true },
      });
    }
  }

  const existing = await prisma.eventType.findFirst({
    where: { userId: user.id, slug: SLUG },
  });

  const eventType = existing
    ? await prisma.eventType.update({
        where: { id: existing.id },
        data: { name: "Smoke Test", durationMinutes: 15, enabled: true },
      })
    : await prisma.eventType.create({
        data: {
          userId: user.id,
          name: "Smoke Test",
          slug: SLUG,
          durationMinutes: 15,
          enabled: true,
        },
      });

  const sources = await prisma.calendarSource.count({ where: { userId: user.id } });

  console.log(`user       ${user.id} (${user.email})`);
  console.log(`booking    /book/${USERNAME}/${SLUG}`);
  console.log(`eventType  ${eventType.id}, ${eventType.durationMinutes} min`);
  console.log(`sources    ${sources} (must be 0 — otherwise the test writes to a calendar)`);
  if (sources > 0) {
    console.error("Refusing to look healthy: the smoke account has a calendar source.");
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
