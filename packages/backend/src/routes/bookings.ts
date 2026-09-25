import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";
import { decrypt } from "../encryption";
import { getProvider } from "../providers";
import { TokenSet } from "../types";
import { findBookingCalendarEntry } from "../lib/booking-calendar";

interface AuthenticatedRequest {
  user: AuthUser;
}

export async function bookingsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // List bookings
  app.get("/api/bookings", async (request) => {
    const { user } = request as unknown as AuthenticatedRequest;

    const bookings = await prisma.booking.findMany({
      where: { userId: user.id },
      include: { eventType: { select: { name: true, durationMinutes: true } } },
      orderBy: { startTime: "asc" },
    });

    return bookings;
  });

  // Cancel booking
  app.delete<{ Params: { id: string } }>(
    "/api/bookings/:id",
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { id } = request.params;

      const booking = await prisma.booking.findFirst({
        where: { id, userId: user.id },
      });

      if (!booking) {
        return reply.code(404).send({ error: "Booking not found" });
      }

      // Delete provider event if future booking
      let providerEventDeleted = false;
      if (booking.providerEventId && booking.startTime > new Date()) {
        try {
          const bookingEntry = await findBookingCalendarEntry(prisma, user.id, booking.eventTypeId);

          // ICS sources have no API to delete through; the event stays until
          // the host removes it.
          if (bookingEntry && !bookingEntry.source.emailForInvitations) {
            const provider = getProvider(bookingEntry.source.provider);
            const creds = JSON.parse(
              decrypt(bookingEntry.source.credentials, process.env.ENCRYPTION_SECRET!)
            );
            const token: TokenSet = {
              accessToken: creds.accessToken || "",
              refreshToken: creds.refreshToken || null,
              expiresAt: creds.expiresAt ? new Date(creds.expiresAt) : null,
            };
            await provider.deleteEvent(token, bookingEntry.providerCalendarId, booking.providerEventId);
            providerEventDeleted = true;
          }
        } catch (err) {
          console.error(`[bookings] Failed to delete provider event for booking ${id}:`, err);
        }
      }

      await prisma.booking.update({
        where: { id },
        data: {
          status: "cancelled",
          // Keep providerEventId when deletion failed, so reconcileBookings retries it.
          ...(providerEventDeleted && { providerEventId: null }),
        },
      });

      return { success: true };
    }
  );
}
