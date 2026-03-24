import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";

interface AuthenticatedRequest {
  user: AuthUser;
}

const DEFAULT_RULES = [
  { dayOfWeek: 0, startTime: "09:00", endTime: "17:00", enabled: false }, // Sun
  { dayOfWeek: 1, startTime: "09:00", endTime: "17:00", enabled: true },  // Mon
  { dayOfWeek: 2, startTime: "09:00", endTime: "17:00", enabled: true },  // Tue
  { dayOfWeek: 3, startTime: "09:00", endTime: "17:00", enabled: true },  // Wed
  { dayOfWeek: 4, startTime: "09:00", endTime: "17:00", enabled: true },  // Thu
  { dayOfWeek: 5, startTime: "09:00", endTime: "17:00", enabled: true },  // Fri
  { dayOfWeek: 6, startTime: "09:00", endTime: "17:00", enabled: false }, // Sat
];

export async function availabilityRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // Get availability rules (seed defaults if none exist)
  app.get("/api/availability", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;

    let rules = await prisma.availabilityRule.findMany({
      where: { userId: user.id, eventTypeId: null },
      orderBy: { dayOfWeek: "asc" },
    });

    if (rules.length === 0) {
      await prisma.availabilityRule.createMany({
        data: DEFAULT_RULES.map((r) => ({ ...r, userId: user.id })),
      });
      rules = await prisma.availabilityRule.findMany({
        where: { userId: user.id, eventTypeId: null },
        orderBy: { dayOfWeek: "asc" },
      });
    }

    return rules;
  });

  // Update availability rules (all 7 at once)
  app.put<{ Body: Array<{ dayOfWeek: number; startTime: string; endTime: string; enabled: boolean }> }>(
    "/api/availability",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const rules = request.body;

      if (!Array.isArray(rules) || rules.length !== 7) {
        return reply.code(400).send({ error: "Must provide exactly 7 rules (one per day)" });
      }

      const results = await Promise.all(
        rules.map(async (rule) => {
          const existing = await prisma.availabilityRule.findFirst({
            where: { userId: user.id, eventTypeId: null, dayOfWeek: rule.dayOfWeek },
          });
          if (existing) {
            return prisma.availabilityRule.update({
              where: { id: existing.id },
              data: { startTime: rule.startTime, endTime: rule.endTime, enabled: rule.enabled },
            });
          }
          return prisma.availabilityRule.create({
            data: {
              userId: user.id,
              dayOfWeek: rule.dayOfWeek,
              startTime: rule.startTime,
              endTime: rule.endTime,
              enabled: rule.enabled,
            },
          });
        })
      );

      return results;
    }
  );
}
