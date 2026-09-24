import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

vi.mock("../lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    eventType: { findFirst: vi.fn(), findUnique: vi.fn() },
    availabilityRule: { findUnique: vi.fn(), findFirst: vi.fn() },
    event: { findMany: vi.fn() },
    booking: { findMany: vi.fn(), update: vi.fn() },
    calendarEntry: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("../encryption", () => ({ decrypt: vi.fn(() => "{}") }));
vi.mock("../providers", () => ({ getProvider: vi.fn() }));
vi.mock("../queues", () => ({
  syncQueue: { add: vi.fn(() => Promise.resolve()) },
  emailQueue: { add: vi.fn(() => Promise.resolve()) },
}));
vi.mock("../lib/ics-invitation", () => ({ buildIcsInvitation: vi.fn() }));

import { prisma } from "../lib/prisma";
import { getProvider } from "../providers";
import { publicBookingRoutes } from "./public-booking";

const mockPrisma = vi.mocked(prisma, true);
const createEvent = vi.fn();

let app: FastifyInstance;

const START = "2026-04-13T10:00:00.000Z"; // Monday, inside 09:00–17:00 UTC

beforeEach(async () => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-04-12T00:00:00Z"));

  mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "host@example.com", timezone: "UTC" } as never);
  mockPrisma.eventType.findFirst.mockResolvedValue({
    id: "et-1", name: "Call", durationMinutes: 30, location: null,
    bookingCalendarEntryId: null, calendars: [], availabilityRules: [],
  } as never);
  mockPrisma.eventType.findUnique.mockResolvedValue(null);
  mockPrisma.availabilityRule.findFirst.mockResolvedValue({ startTime: "09:00", endTime: "17:00", enabled: true } as never);
  mockPrisma.event.findMany.mockResolvedValue([]);
  mockPrisma.booking.findMany.mockResolvedValue([]);
  mockPrisma.calendarEntry.findFirst.mockResolvedValue({
    providerCalendarId: "primary",
    source: { id: "src-1", provider: "google", credentials: "x", emailForInvitations: null },
  } as never);
  vi.mocked(getProvider).mockReturnValue({ createEvent } as never);
  createEvent.mockResolvedValue({ sourceEventId: "gcal-1" });

  app = Fastify();
  await app.register(publicBookingRoutes);
  await app.ready();
});

afterEach(async () => {
  await app.close();
  vi.useRealTimers();
});

function book() {
  return app.inject({
    method: "POST",
    url: "/api/public/book/host/call",
    payload: { startTime: START, guestName: "Gast", guestEmail: "gast@example.com" },
  });
}

/**
 * The calendar event carries the manage link. It used to be written before the
 * booking was stored, so a failed insert left an event whose link answered
 * "booking not found" — seen in production on 2026-08-27.
 */
describe("booking is stored before the calendar event is written", () => {
  it("writes no calendar event when the slot is taken inside the lock", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("SLOT_TAKEN"));

    const res = await book();

    expect(res.statusCode).toBe(409);
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("writes no calendar event when the insert fails", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("P2010"));

    const res = await book();

    expect(res.statusCode).toBe(500);
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("links the calendar event to the stored booking", async () => {
    mockPrisma.$transaction.mockResolvedValue({
      id: "b-1", startTime: new Date(START), endTime: new Date("2026-04-13T10:30:00Z"),
    } as never);
    mockPrisma.booking.update.mockImplementation((async (args: { data: object }) => ({
      id: "b-1", startTime: new Date(START), endTime: new Date("2026-04-13T10:30:00Z"), ...args.data,
    })) as never);

    const res = await book();

    expect(res.statusCode).toBe(201);
    expect(createEvent).toHaveBeenCalledOnce();
    const description = createEvent.mock.calls[0][2].description as string;
    expect(description).toContain(res.json().booking.manageUrl);
    expect(mockPrisma.booking.update).toHaveBeenCalledWith({
      where: { id: "b-1" },
      data: { providerEventId: "gcal-1", icsUid: null },
    });
  });

  it("keeps the booking when linking the calendar event fails", async () => {
    mockPrisma.$transaction.mockResolvedValue({
      id: "b-1", startTime: new Date(START), endTime: new Date("2026-04-13T10:30:00Z"),
    } as never);
    mockPrisma.booking.update.mockRejectedValue(new Error("db down"));

    const res = await book();

    expect(res.statusCode).toBe(201);
  });
});
