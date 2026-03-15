import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: [],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Creates a Prisma client extension that scopes all queries to a specific user.
 * This enforces tenant isolation at the data layer.
 */
export function scopedPrisma(userId: string) {
  return prisma.$extends({
    query: {
      calendarSource: {
        async $allOperations({ args, query }: { args: any; query: any }) {
          if ("where" in args) {
            (args as any).where = { ...(args as any).where, userId };
          }
          return query(args);
        },
      },
    },
  });
}
