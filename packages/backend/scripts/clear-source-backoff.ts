/**
 * Clear adaptive sync backoff for one or more calendar sources.
 *
 * Resets `consecutiveErrors` to 0 and `nextSyncAfter` to null so the worker
 * picks the source up on the next scheduled tick.
 *
 * Usage:
 *   npx tsx scripts/clear-source-backoff.ts <sourceId> [<sourceId> ...]
 *   npx tsx scripts/clear-source-backoff.ts --all
 *
 * Requires DATABASE_URL to be set.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "Usage: npx tsx scripts/clear-source-backoff.ts <sourceId> [<sourceId> ...]\n" +
        "       npx tsx scripts/clear-source-backoff.ts --all"
    );
    process.exit(1);
  }

  const where =
    args[0] === "--all"
      ? { nextSyncAfter: { not: null } }
      : { id: { in: args } };

  const result = await prisma.calendarSource.updateMany({
    where,
    data: { consecutiveErrors: 0, nextSyncAfter: null },
  });

  console.log(`Cleared backoff on ${result.count} source(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
