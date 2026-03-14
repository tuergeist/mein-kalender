import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";
import { encrypt, decrypt } from "@calendar-sync/shared";

interface AuthenticatedRequest {
  user: AuthUser;
}

export async function sourcesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // List all calendar sources for the authenticated user
  app.get("/api/sources", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const sources = await prisma.calendarSource.findMany({
      where: { userId: user.id },
      include: { calendarEntries: true },
    });

    return sources.map((s: any) => ({
      ...s,
      credentials: undefined, // never expose credentials
    }));
  });

  // Get a single source
  app.get<{ Params: { id: string } }>("/api/sources/:id", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const source = await prisma.calendarSource.findFirst({
      where: { id: request.params.id, userId: user.id },
      include: { calendarEntries: true },
    });

    if (!source) {
      return reply.code(404).send({ error: "Not found" });
    }

    return { ...source, credentials: undefined };
  });

  // Create a new calendar source
  app.post<{
    Body: {
      provider: string;
      label?: string;
      credentials: Record<string, string>;
      syncInterval?: number;
      icsUrl?: string;
    };
  }>("/api/sources", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const { provider, label, credentials, syncInterval, icsUrl } = request.body;

    const encryptedCredentials = encrypt(
      JSON.stringify(credentials),
      process.env.ENCRYPTION_SECRET!
    );

    const source = await prisma.calendarSource.create({
      data: {
        userId: user.id,
        provider,
        label,
        credentials: encryptedCredentials,
        syncInterval: syncInterval ?? 300,
        icsUrl,
      },
    });

    return { ...source, credentials: undefined };
  });

  // Update a source
  app.put<{
    Params: { id: string };
    Body: {
      label?: string;
      syncInterval?: number;
    };
  }>("/api/sources/:id", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const existing = await prisma.calendarSource.findFirst({
      where: { id: request.params.id, userId: user.id },
    });

    if (!existing) {
      return reply.code(404).send({ error: "Not found" });
    }

    const updated = await prisma.calendarSource.update({
      where: { id: request.params.id },
      data: {
        label: request.body.label,
        syncInterval: request.body.syncInterval,
      },
    });

    return { ...updated, credentials: undefined };
  });

  // Delete a source
  app.delete<{ Params: { id: string } }>("/api/sources/:id", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const existing = await prisma.calendarSource.findFirst({
      where: { id: request.params.id, userId: user.id },
    });

    if (!existing) {
      return reply.code(404).send({ error: "Not found" });
    }

    await prisma.calendarSource.delete({ where: { id: request.params.id } });
    return { success: true };
  });
}
