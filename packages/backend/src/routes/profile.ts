import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";

interface AuthenticatedRequest {
  user: AuthUser;
}

export async function profileRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // Get profile
  app.get("/api/profile", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, username: true, displayName: true, avatarUrl: true },
    });

    return profile;
  });

  // Set username
  app.put<{ Body: { username: string } }>(
    "/api/profile/username",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { username } = request.body;

      if (!username || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(username)) {
        return reply.code(400).send({ error: "Username must contain only lowercase letters, numbers, and hyphens" });
      }

      if (username.length < 3 || username.length > 30) {
        return reply.code(400).send({ error: "Username must be 3-30 characters" });
      }

      // Check uniqueness
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing && existing.id !== user.id) {
        return reply.code(409).send({ error: "Username already taken" });
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { username },
        select: { id: true, email: true, username: true, displayName: true },
      });

      return updated;
    }
  );
}
