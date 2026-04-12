import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";
import { cancelSubscription } from "../lib/mollie";

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
      select: {
        id: true, email: true, username: true, displayName: true, avatarUrl: true,
        brandColor: true, accentColor: true, backgroundUrl: true, backgroundOpacity: true,
        bookingCalendarEntryId: true,
      },
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

  // Update branding
  app.put<{ Body: { brandColor?: string | null; accentColor?: string | null; avatarUrl?: string | null; backgroundUrl?: string | null; backgroundOpacity?: number | null } }>(
    "/api/profile/branding",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { brandColor, accentColor, avatarUrl, backgroundUrl, backgroundOpacity } = request.body;

      const hexPattern = /^#[0-9a-fA-F]{6}$/;
      if (brandColor !== undefined && brandColor !== null && !hexPattern.test(brandColor)) {
        return reply.code(400).send({ error: "brandColor must be a valid hex color (e.g. #e11d48)" });
      }
      if (accentColor !== undefined && accentColor !== null && !hexPattern.test(accentColor)) {
        return reply.code(400).send({ error: "accentColor must be a valid hex color (e.g. #3b82f6)" });
      }

      const data: Record<string, string | number | null> = {};
      if (brandColor !== undefined) data.brandColor = brandColor;
      if (accentColor !== undefined) data.accentColor = accentColor;
      if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
      if (backgroundUrl !== undefined) data.backgroundUrl = backgroundUrl;
      if (backgroundOpacity !== undefined) data.backgroundOpacity = backgroundOpacity;

      // Clean up UserImage records when clearing uploaded images
      if (avatarUrl === null) {
        await prisma.userImage.deleteMany({ where: { userId: user.id, type: "avatar" } });
      }
      if (backgroundUrl === null) {
        await prisma.userImage.deleteMany({ where: { userId: user.id, type: "background" } });
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data,
        select: { brandColor: true, accentColor: true, avatarUrl: true, backgroundUrl: true, backgroundOpacity: true },
      });

      return updated;
    }
  );

  // GDPR data export (Article 20)
  app.get("/api/profile/export", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        accounts: { select: { provider: true, providerAccountId: true, type: true } },
        bookings: { select: { id: true, guestName: true, guestEmail: true, startTime: true, endTime: true, status: true, notes: true, createdAt: true } },
        eventTypes: { select: { id: true, name: true, slug: true, durationMinutes: true, description: true, createdAt: true } },
        availabilityRules: { select: { dayOfWeek: true, startTime: true, endTime: true, enabled: true } },
        calendarSources: { select: { id: true, provider: true, label: true, createdAt: true } },
      },
    });

    if (!fullUser) {
      return reply.code(404).send({ error: "User not found" });
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        id: fullUser.id,
        email: fullUser.email,
        username: fullUser.username,
        displayName: fullUser.displayName,
        emailVerified: fullUser.emailVerified,
        createdAt: fullUser.createdAt,
      },
      accounts: fullUser.accounts,
      calendarSources: fullUser.calendarSources,
      eventTypes: fullUser.eventTypes,
      availabilityRules: fullUser.availabilityRules,
      bookings: fullUser.bookings,
    };

    reply.header("Content-Disposition", "attachment; filename=mein-kalender-export.json");
    reply.header("Content-Type", "application/json");
    return exportData;
  });

  // Delete account (enhanced with Mollie cleanup)
  app.delete("/api/profile", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;

    // Cancel Mollie subscription before deletion
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mollieCustomerId: true, subscriptionId: true },
    });

    if (dbUser?.mollieCustomerId && dbUser?.subscriptionId) {
      try {
        await cancelSubscription(dbUser.mollieCustomerId, dbUser.subscriptionId);
      } catch (err) {
        console.error(`[profile] Failed to cancel Mollie subscription for user ${user.id}:`, err);
      }
    }

    await prisma.user.delete({ where: { id: user.id } });

    return reply.code(204).send();
  });

  // Set booking calendar
  app.put<{ Body: { bookingCalendarEntryId: string | null } }>(
    "/api/profile/booking-calendar",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { bookingCalendarEntryId } = request.body;

      if (bookingCalendarEntryId) {
        const entry = await prisma.calendarEntry.findFirst({
          where: { id: bookingCalendarEntryId, source: { userId: user.id }, readOnly: false },
        });
        if (!entry) {
          return reply.code(404).send({ error: "Calendar not found or read-only" });
        }
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { bookingCalendarEntryId },
        select: { id: true, bookingCalendarEntryId: true },
      });

      return updated;
    }
  );
}
