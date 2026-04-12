import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing anything that uses it
vi.mock("../lib/prisma", () => ({
  prisma: {
    availabilityRule: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    event: {
      findMany: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
  },
}));

// Mock modules that public-booking imports but we don't need
vi.mock("../encryption", () => ({ decrypt: vi.fn() }));
vi.mock("../providers", () => ({ getProvider: vi.fn() }));
vi.mock("../queues", () => ({
  syncQueue: { add: vi.fn() },
  emailQueue: { add: vi.fn() },
}));
vi.mock("../lib/ics-invitation", () => ({ buildIcsInvitation: vi.fn() }));

import { prisma } from "../lib/prisma";
import { computeSlotsForPreview } from "../routes/public-booking";

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  // Set "now" to 2026-04-12 00:00 UTC so all slots are in the future
  vi.setSystemTime(new Date("2026-04-12T00:00:00Z"));
});

describe("computeSlots", () => {
  it("returns empty when no availability rule exists", async () => {
    mockPrisma.availabilityRule.findUnique.mockResolvedValue(null);
    mockPrisma.availabilityRule.findFirst.mockResolvedValue(null);

    const slots = await computeSlotsForPreview("user-1", 30, "2026-04-13");
    expect(slots).toEqual([]);
  });

  it("returns empty when rule is disabled", async () => {
    mockPrisma.availabilityRule.findFirst.mockResolvedValue({
      id: "rule-1",
      userId: "user-1",
      eventTypeId: null,
      dayOfWeek: 1, // Monday
      startTime: "09:00",
      endTime: "17:00",
      enabled: false,
    });

    const slots = await computeSlotsForPreview("user-1", 30, "2026-04-13"); // Monday
    expect(slots).toEqual([]);
  });

  it("generates correct 30-minute slots for an 8-hour window", async () => {
    mockPrisma.availabilityRule.findFirst.mockResolvedValue({
      id: "rule-1",
      userId: "user-1",
      eventTypeId: null,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "17:00",
      enabled: true,
    });
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.booking.findMany.mockResolvedValue([]);

    const slots = await computeSlotsForPreview("user-1", 30, "2026-04-13");
    // 8 hours / 30 min = 16 slots
    expect(slots).toHaveLength(16);
    expect(slots[0]).toBe("2026-04-13T09:00:00.000Z");
    expect(slots[slots.length - 1]).toBe("2026-04-13T16:30:00.000Z");
  });

  it("generates correct 60-minute slots", async () => {
    mockPrisma.availabilityRule.findFirst.mockResolvedValue({
      id: "rule-1",
      userId: "user-1",
      eventTypeId: null,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "17:00",
      enabled: true,
    });
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.booking.findMany.mockResolvedValue([]);

    const slots = await computeSlotsForPreview("user-1", 60, "2026-04-13");
    expect(slots).toHaveLength(8);
    expect(slots[0]).toBe("2026-04-13T09:00:00.000Z");
    expect(slots[slots.length - 1]).toBe("2026-04-13T16:00:00.000Z");
  });

  it("excludes slots that overlap with busy events", async () => {
    mockPrisma.availabilityRule.findFirst.mockResolvedValue({
      id: "rule-1",
      userId: "user-1",
      eventTypeId: null,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "12:00",
      enabled: true,
    });
    mockPrisma.event.findMany.mockResolvedValue([
      {
        startTime: new Date("2026-04-13T10:00:00Z"),
        endTime: new Date("2026-04-13T11:00:00Z"),
        allDay: false,
        providerMetadata: null,
      },
    ]);
    mockPrisma.booking.findMany.mockResolvedValue([]);

    const slots = await computeSlotsForPreview("user-1", 30, "2026-04-13");
    // 09:00-12:00 = 6 slots of 30min, minus 10:00 and 10:30 (overlap with event) = 4 slots
    expect(slots).toHaveLength(4);
    expect(slots).not.toContain("2026-04-13T10:00:00.000Z");
    expect(slots).not.toContain("2026-04-13T10:30:00.000Z");
  });

  it("excludes slots that overlap with existing bookings", async () => {
    mockPrisma.availabilityRule.findFirst.mockResolvedValue({
      id: "rule-1",
      userId: "user-1",
      eventTypeId: null,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "11:00",
      enabled: true,
    });
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        startTime: new Date("2026-04-13T09:00:00Z"),
        endTime: new Date("2026-04-13T09:30:00Z"),
      },
    ]);

    const slots = await computeSlotsForPreview("user-1", 30, "2026-04-13");
    expect(slots).not.toContain("2026-04-13T09:00:00.000Z");
    expect(slots).toContain("2026-04-13T09:30:00.000Z");
  });

  it("skips free/transparent events", async () => {
    mockPrisma.availabilityRule.findFirst.mockResolvedValue({
      id: "rule-1",
      userId: "user-1",
      eventTypeId: null,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
      enabled: true,
    });
    mockPrisma.event.findMany.mockResolvedValue([
      {
        startTime: new Date("2026-04-13T09:00:00Z"),
        endTime: new Date("2026-04-13T10:00:00Z"),
        allDay: false,
        providerMetadata: { showAs: "free" },
      },
    ]);
    mockPrisma.booking.findMany.mockResolvedValue([]);

    const slots = await computeSlotsForPreview("user-1", 30, "2026-04-13");
    // Free event should not block slots
    expect(slots).toHaveLength(2);
  });

  it("returns empty for a fully booked day", async () => {
    mockPrisma.availabilityRule.findFirst.mockResolvedValue({
      id: "rule-1",
      userId: "user-1",
      eventTypeId: null,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
      enabled: true,
    });
    mockPrisma.event.findMany.mockResolvedValue([
      {
        startTime: new Date("2026-04-13T09:00:00Z"),
        endTime: new Date("2026-04-13T10:00:00Z"),
        allDay: false,
        providerMetadata: null,
      },
    ]);
    mockPrisma.booking.findMany.mockResolvedValue([]);

    const slots = await computeSlotsForPreview("user-1", 30, "2026-04-13");
    expect(slots).toHaveLength(0);
  });

  it("uses per-event-type rule over user default", async () => {
    // Per-event-type rule found
    mockPrisma.availabilityRule.findUnique.mockResolvedValue({
      id: "rule-et",
      userId: "user-1",
      eventTypeId: "et-1",
      dayOfWeek: 1,
      startTime: "10:00",
      endTime: "12:00",
      enabled: true,
    });
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.booking.findMany.mockResolvedValue([]);

    const slots = await computeSlotsForPreview("user-1", 60, "2026-04-13", [], "et-1");
    expect(slots).toHaveLength(2);
    expect(slots[0]).toBe("2026-04-13T10:00:00.000Z");
    expect(slots[1]).toBe("2026-04-13T11:00:00.000Z");
    // Should not have called findFirst (user default) since event-type rule was found
    expect(mockPrisma.availabilityRule.findFirst).not.toHaveBeenCalled();
  });

  it("does not return slots in the past", async () => {
    // Set current time to 2026-04-13 10:15 UTC
    vi.setSystemTime(new Date("2026-04-13T10:15:00Z"));

    mockPrisma.availabilityRule.findFirst.mockResolvedValue({
      id: "rule-1",
      userId: "user-1",
      eventTypeId: null,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "12:00",
      enabled: true,
    });
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.booking.findMany.mockResolvedValue([]);

    const slots = await computeSlotsForPreview("user-1", 30, "2026-04-13");
    // 10:15 -> next slot boundary at 10:30, then 11:00, 11:30 = 3 slots
    expect(slots).toHaveLength(3);
    expect(slots[0]).toBe("2026-04-13T10:30:00.000Z");
  });
});
