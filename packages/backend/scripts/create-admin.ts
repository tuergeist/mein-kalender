/**
 * One-time admin user creation script.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=securepass npx tsx scripts/create-admin.ts
 *
 * Requires DATABASE_URL to be set.
 */
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/create-admin.ts");
    process.exit(1);
  }

  if (password.length < 12) {
    console.error("Error: Admin password must be at least 12 characters");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "admin" },
    create: { email, passwordHash, role: "admin", emailVerified: true },
  });

  console.log(`Admin user created/updated: ${user.email} (${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
