import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

vi.mock("../lib/prisma", () => ({
  prisma: {
    booking: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    eventType: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    calendarEntry: { findFirst: vi.fn() },
    event: { findMany: vi.fn() },
  },
}));
vi.mock("../lib/auth", () => ({
  authenticate: async (request: any) => {
    request.user = { id: "user-1", email: "host@example.com", role: "user" };
  },
}));
vi.mock("../queues", () => ({
  conflictQueue: { add: vi.fn() },
  targetSyncQueue: { add: vi.fn() },
  syncQueue: { add: vi.fn() },
  emailQueue: { add: vi.fn() },
}));
const deleteEvent = vi.fn();
vi.mock("../providers", () => ({ getProvider: () => ({ deleteEvent }) }));
vi.mock("../encryption", () => ({ decrypt: () => "{}" }));

import { prisma } from "../lib/prisma";
import { bookingsRoutes } from "../routes/bookings";
import { reconcileBookings } from "../sync-job";

const mockPrisma = vi.mocked(prisma, true) as any;

// The booking calendar is set on the user, not on the event type, and it is
// not the target calendar. Before, cancel in the dashboard deleted from the
// target calendar and the sync's retry skipped bookings without an event-type
// calendar — the event stayed in the booking calendar in both cases.
const bookingCalendar = {
  id: "entry-booking",
  providerCalendarId: "bookings@group.calendar.google.com",
  source: { id: "src-1", provider: "google", credentials: "x", emailForInvitations: null },
};

const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
const booking = {
  id: "b-1", userId: "user-1", eventTypeId: "et-1", guestName: "Gast",
  providerEventId: "gcal-1", startTime: future, status: "confirmed",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.eventType.findUnique.mockResolvedValue({ bookingCalendarEntryId: null });
  mockPrisma.user.findUnique.mockResolvedValue({ bookingCalendarEntryId: "entry-booking" });
  mockPrisma.calendarEntry.findFirst.mockImplementation(async (args: any) =>
    args.where.id === "entry-booking" ? bookingCalendar : { providerCalendarId: "target", source: bookingCalendar.source });
  deleteEvent.mockResolvedValue(undefined);
});

describe("cancelling deletes the event from the booking calendar", () => {
  it("dashboard cancel", async () => {
    mockPrisma.booking.findFirst.mockResolvedValue(booking);
    const app = Fastify();
    await app.register(bookingsRoutes);

    const res = await app.inject({ method: "DELETE", url: "/api/bookings/b-1" });
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(deleteEvent).toHaveBeenCalledWith(expect.anything(), "bookings@group.calendar.google.com", "gcal-1");
    expect(mockPrisma.booking.update).toHaveBeenCalledWith({
      where: { id: "b-1" },
      data: { status: "cancelled", providerEventId: null },
    });
  });

  it("dashboard cancel keeps providerEventId when deletion fails, for the retry", async () => {
    mockPrisma.booking.findFirst.mockResolvedValue(booking);
    deleteEvent.mockRejectedValue(new Error("google down"));
    const app = Fastify();
    await app.register(bookingsRoutes);

    await app.inject({ method: "DELETE", url: "/api/bookings/b-1" });
    await app.close();

    expect(mockPrisma.booking.update).toHaveBeenCalledWith({
      where: { id: "b-1" },
      data: { status: "cancelled" },
    });
  });

  it("sync retry-delete", async () => {
    mockPrisma.booking.findMany
      .mockResolvedValueOnce([]) // confirmed bookings to reconcile
      .mockResolvedValueOnce([{ ...booking, status: "cancelled" }]); // failed deletes

    await reconcileBookings(prisma as any, "user-1");

    expect(deleteEvent).toHaveBeenCalledWith(expect.anything(), "bookings@group.calendar.google.com", "gcal-1");
    expect(mockPrisma.booking.update).toHaveBeenCalledWith({
      where: { id: "b-1" },
      data: { providerEventId: null },
    });
  });
});
