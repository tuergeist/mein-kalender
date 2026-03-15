import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    let dbStatus = "ok";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = "error";
    }

    return {
      status: dbStatus === "ok" ? "ok" : "degraded",
      database: dbStatus,
      uptime: process.uptime(),
    };
  });
}
