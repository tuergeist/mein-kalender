import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";
import { encrypt, decrypt } from "../encryption";

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
        syncInterval: syncInterval ?? 600,
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
      fetchDaysInAdvance?: number;
    };
  }>("/api/sources/:id", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const existing = await prisma.calendarSource.findFirst({
      where: { id: request.params.id, userId: user.id },
    });

    if (!existing) {
      return reply.code(404).send({ error: "Not found" });
    }

    const VALID_FETCH_DAYS = [30, 60, 90];
    if (request.body.fetchDaysInAdvance !== undefined && !VALID_FETCH_DAYS.includes(request.body.fetchDaysInAdvance)) {
      return reply.code(400).send({ error: "fetchDaysInAdvance must be 30, 60, or 90" });
    }

    const updated = await prisma.calendarSource.update({
      where: { id: request.params.id },
      data: {
        ...(request.body.label !== undefined && { label: request.body.label }),
        ...(request.body.syncInterval !== undefined && { syncInterval: request.body.syncInterval }),
        ...(request.body.fetchDaysInAdvance !== undefined && { fetchDaysInAdvance: request.body.fetchDaysInAdvance }),
      },
    });

    return { ...updated, credentials: undefined };
  });

  // Toggle calendar entry enabled state
  app.patch<{
    Params: { id: string };
    Body: { enabled?: boolean };
  }>("/api/calendar-entries/:id", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const entry = await prisma.calendarEntry.findFirst({
      where: {
        id: request.params.id,
        source: { userId: user.id },
      },
    });

    if (!entry) {
      return reply.code(404).send({ error: "Not found" });
    }

    const updated = await prisma.calendarEntry.update({
      where: { id: request.params.id },
      data: {
        ...(request.body.enabled !== undefined && { enabled: request.body.enabled }),
      },
    });

    return updated;
  });

  // Update calendar entry user color
  app.patch<{
    Params: { id: string };
    Body: { userColor: string | null };
  }>("/api/calendar-entries/:id/color", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const entry = await prisma.calendarEntry.findFirst({
      where: {
        id: request.params.id,
        source: { userId: user.id },
      },
    });

    if (!entry) {
      return reply.code(404).send({ error: "Not found" });
    }

    const updated = await prisma.calendarEntry.update({
      where: { id: request.params.id },
      data: { userColor: request.body.userColor },
    });

    return updated;
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
