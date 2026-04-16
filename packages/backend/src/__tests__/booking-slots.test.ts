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
    user: {
      findUnique: vi.fn(),
    },
    eventType: {
      findUnique: vi.fn(),
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
  vi.resetAllMocks();
  vi.useFakeTimers();
  // Set "now" to 2026-04-12 00:00 UTC so all slots are in the future
  vi.setSystemTime(new Date("2026-04-12T00:00:00Z"));
  // Default: no buffers configured
  mockPrisma.user.findUnique.mockResolvedValue({
    defaultBufferBeforeMinutes: 0,
    defaultBufferAfterMinutes: 0,
    applyBuffersToAllEvents: false,
  });
  mockPrisma.eventType.findUnique.mockResolvedValue(null);
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

  describe("buffer time", () => {
    it("excludes slots where bufferAfter would overlap a busy event", async () => {
      // 30-min event type with 15-min buffer after
      // Working hours 09:00-12:00, event at 10:00-10:30
      mockPrisma.availabilityRule.findFirst.mockResolvedValue({
        id: "rule-1", userId: "user-1", eventTypeId: null, dayOfWeek: 1,
        startTime: "09:00", endTime: "12:00", enabled: true,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        defaultBufferBeforeMinutes: 0, defaultBufferAfterMinutes: 0, applyBuffersToAllEvents: false,
      });
      mockPrisma.eventType.findUnique.mockResolvedValue({
        bufferBeforeMinutes: null, bufferAfterMinutes: 15,
      });
      mockPrisma.event.findMany.mockResolvedValue([{
        startTime: new Date("2026-04-13T10:00:00Z"),
        endTime: new Date("2026-04-13T10:30:00Z"),
        allDay: false, providerMetadata: null,
      }]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const slots = await computeSlotsForPreview("user-1", 30, "2026-04-13", [], "et-1");
      // 09:00 reserved [09:00, 09:45] — no overlap with event [10:00, 10:30] → included
      expect(slots).toContain("2026-04-13T09:00:00.000Z");
      // 09:30 reserved [09:30, 10:15] — overlaps event [10:00, 10:30] → excluded
      expect(slots).not.toContain("2026-04-13T09:30:00.000Z");
      // 10:00 reserved [10:00, 10:45] — overlaps event → excluded
      expect(slots).not.toContain("2026-04-13T10:00:00.000Z");
      // 10:30 reserved [10:30, 11:15] — no overlap (event ends at 10:30, edge-touching) → included
      expect(slots).toContain("2026-04-13T10:30:00.000Z");
      // 11:00 reserved [11:00, 11:45] → included
      expect(slots).toContain("2026-04-13T11:00:00.000Z");
      // 11:30 reserved [11:30, 12:15] — extends beyond working hours → excluded
      expect(slots).not.toContain("2026-04-13T11:30:00.000Z");
      expect(slots).toHaveLength(3); // 09:00, 10:30, 11:00
    });

    it("excludes slots where bufferBefore would overlap a busy event", async () => {
      // 30-min event with 10-min buffer before
      // Working hours 09:00-12:00, event at 09:00-09:30
      // Slot at 09:30 needs [09:20, 10:00] free — overlaps busy event ending at 09:30 → excluded
      mockPrisma.availabilityRule.findFirst.mockResolvedValue({
        id: "rule-1", userId: "user-1", eventTypeId: null, dayOfWeek: 1,
        startTime: "09:00", endTime: "12:00", enabled: true,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        defaultBufferBeforeMinutes: 0, defaultBufferAfterMinutes: 0, applyBuffersToAllEvents: false,
      });
      mockPrisma.eventType.findUnique.mockResolvedValue({
        bufferBeforeMinutes: 10, bufferAfterMinutes: null,
      });
      mockPrisma.event.findMany.mockResolvedValue([{
        startTime: new Date("2026-04-13T09:00:00Z"),
        endTime: new Date("2026-04-13T09:30:00Z"),
        allDay: false, providerMetadata: null,
      }]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const slots = await computeSlotsForPreview("user-1", 30, "2026-04-13", [], "et-1");
      // 09:00 — buffer before extends to 08:50 which is before working hours → excluded
      expect(slots).not.toContain("2026-04-13T09:00:00.000Z");
      // 09:30 — reserved [09:20, 10:00], overlaps event [09:00, 09:30] (09:20 < 09:30) → excluded
      expect(slots).not.toContain("2026-04-13T09:30:00.000Z");
      // 10:00 — reserved [09:50, 10:30], no overlap with event ending 09:30 → included
      expect(slots).toContain("2026-04-13T10:00:00.000Z");
      // 10:30 onwards all fine
      expect(slots).toContain("2026-04-13T10:30:00.000Z");
      expect(slots).toContain("2026-04-13T11:00:00.000Z");
      expect(slots).toContain("2026-04-13T11:30:00.000Z");
      expect(slots).toHaveLength(4); // 10:00, 10:30, 11:00, 11:30
    });

    it("bufferBefore prevents earliest slots that would extend before working hours", async () => {
      // Working hours 09:00-17:00, 15-min buffer before, 30-min duration
      // 09:00 slot needs buffer from 08:45 → before working hours → excluded
      // 09:15 is not on a 30-min boundary from 09:00
      // 09:30 needs buffer from 09:15 → within working hours → included
      mockPrisma.availabilityRule.findFirst.mockResolvedValue({
        id: "rule-1", userId: "user-1", eventTypeId: null, dayOfWeek: 1,
        startTime: "09:00", endTime: "17:00", enabled: true,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        defaultBufferBeforeMinutes: 15, defaultBufferAfterMinutes: 0, applyBuffersToAllEvents: false,
      });
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const slots = await computeSlotsForPreview("user-1", 30, "2026-04-13");
      // 09:00 excluded (buffer starts at 08:45)
      expect(slots).not.toContain("2026-04-13T09:00:00.000Z");
      // 09:30 included (buffer starts at 09:15, within working hours)
      expect(slots).toContain("2026-04-13T09:30:00.000Z");
    });

    it("bufferAfter prevents latest slots that would extend beyond working hours", async () => {
      // Working hours 09:00-17:00, 15-min buffer after, 30-min duration
      // 16:30 slot ends at 17:00 + 15min buffer = 17:15 → beyond working hours → excluded
      // 16:00 slot ends at 16:30 + 15min = 16:45 → within working hours → included
      mockPrisma.availabilityRule.findFirst.mockResolvedValue({
        id: "rule-1", userId: "user-1", eventTypeId: null, dayOfWeek: 1,
        startTime: "09:00", endTime: "17:00", enabled: true,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        defaultBufferBeforeMinutes: 0, defaultBufferAfterMinutes: 15, applyBuffersToAllEvents: false,
      });
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const slots = await computeSlotsForPreview("user-1", 30, "2026-04-13");
      // 16:30 excluded (buffer extends to 17:15)
      expect(slots).not.toContain("2026-04-13T16:30:00.000Z");
      // 16:00 included (buffer extends to 16:45)
      expect(slots).toContain("2026-04-13T16:00:00.000Z");
    });

    it("event type buffer overrides user default", async () => {
      // User default: 30-min after buffer, event type: 5-min after buffer
      mockPrisma.availabilityRule.findFirst.mockResolvedValue({
        id: "rule-1", userId: "user-1", eventTypeId: null, dayOfWeek: 1,
        startTime: "09:00", endTime: "10:00", enabled: true,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        defaultBufferBeforeMinutes: 0, defaultBufferAfterMinutes: 30, applyBuffersToAllEvents: false,
      });
      mockPrisma.eventType.findUnique.mockResolvedValue({
        bufferBeforeMinutes: null, bufferAfterMinutes: 5,
      });
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const slots = await computeSlotsForPreview("user-1", 30, "2026-04-13", [], "et-1");
      // Event type overrides: bufferAfter=5 (not user's 30)
      // 09:00 reserved [09:00, 09:35] within [09:00, 10:00] → included
      expect(slots).toContain("2026-04-13T09:00:00.000Z");
      // 09:30 reserved [09:30, 10:05] extends beyond 10:00 → excluded
      expect(slots).not.toContain("2026-04-13T09:30:00.000Z");
      expect(slots).toHaveLength(1);
    });

    it("explicit zero on event type overrides user default", async () => {
      // User default: 15-min after, event type: explicit 0
      mockPrisma.availabilityRule.findFirst.mockResolvedValue({
        id: "rule-1", userId: "user-1", eventTypeId: null, dayOfWeek: 1,
        startTime: "09:00", endTime: "10:00", enabled: true,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        defaultBufferBeforeMinutes: 0, defaultBufferAfterMinutes: 15, applyBuffersToAllEvents: false,
      });
      mockPrisma.eventType.findUnique.mockResolvedValue({
        bufferBeforeMinutes: null, bufferAfterMinutes: 0,
      });
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const slots = await computeSlotsForPreview("user-1", 30, "2026-04-13", [], "et-1");
      // With 0 buffer: 09:00 and 09:30 both fit
      expect(slots).toHaveLength(2);
    });

    it("event type inherits user default when buffer is null", async () => {
      // User default: 15-min after, event type: null (inherit)
      mockPrisma.availabilityRule.findFirst.mockResolvedValue({
        id: "rule-1", userId: "user-1", eventTypeId: null, dayOfWeek: 1,
        startTime: "09:00", endTime: "10:00", enabled: true,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        defaultBufferBeforeMinutes: 0, defaultBufferAfterMinutes: 15, applyBuffersToAllEvents: false,
      });
      mockPrisma.eventType.findUnique.mockResolvedValue({
        bufferBeforeMinutes: null, bufferAfterMinutes: null,
      });
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const slots = await computeSlotsForPreview("user-1", 30, "2026-04-13", [], "et-1");
      // 09:00 reserved until 09:45 → fine
      // 09:30 reserved until 10:15 → beyond working hours → excluded
      expect(slots).toHaveLength(1);
      expect(slots[0]).toBe("2026-04-13T09:00:00.000Z");
    });

    it("applyBuffersToAllEvents expands busy periods", async () => {
      // Working hours 09:00-12:00, 15-min after buffer, applyBuffersToAllEvents=true
      // Synced event ends at 10:00 → expanded to 10:15
      // Slot at 10:00 overlaps expanded busy period → excluded
      mockPrisma.availabilityRule.findFirst.mockResolvedValue({
        id: "rule-1", userId: "user-1", eventTypeId: null, dayOfWeek: 1,
        startTime: "09:00", endTime: "12:00", enabled: true,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        defaultBufferBeforeMinutes: 0, defaultBufferAfterMinutes: 15, applyBuffersToAllEvents: true,
      });
      mockPrisma.event.findMany.mockResolvedValue([{
        startTime: new Date("2026-04-13T09:30:00Z"),
        endTime: new Date("2026-04-13T10:00:00Z"),
        allDay: false, providerMetadata: null,
      }]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const slots = await computeSlotsForPreview("user-1", 30, "2026-04-13");
      // Event at 09:30-10:00 expanded to 09:30-10:15
      // 09:00 reserved 09:00-09:45 → overlaps expanded busy at 09:30 → excluded
      expect(slots).not.toContain("2026-04-13T09:00:00.000Z");
      // 09:30 and 10:00 overlap the expanded event → excluded
      expect(slots).not.toContain("2026-04-13T09:30:00.000Z");
      expect(slots).not.toContain("2026-04-13T10:00:00.000Z");
      // 10:30 reserved 10:30-11:15 → no overlap with expanded event ending at 10:15 → included
      expect(slots).toContain("2026-04-13T10:30:00.000Z");
    });

    it("applyBuffersToAllEvents=false does not expand busy periods", async () => {
      // Same scenario but applyBuffersToAllEvents=false
      mockPrisma.availabilityRule.findFirst.mockResolvedValue({
        id: "rule-1", userId: "user-1", eventTypeId: null, dayOfWeek: 1,
        startTime: "09:00", endTime: "12:00", enabled: true,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        defaultBufferBeforeMinutes: 0, defaultBufferAfterMinutes: 15, applyBuffersToAllEvents: false,
      });
      mockPrisma.event.findMany.mockResolvedValue([{
        startTime: new Date("2026-04-13T09:30:00Z"),
        endTime: new Date("2026-04-13T10:00:00Z"),
        allDay: false, providerMetadata: null,
      }]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const slots = await computeSlotsForPreview("user-1", 30, "2026-04-13");
      // 09:00 reserved 09:00-09:45 → overlaps non-expanded event starting at 09:30 → excluded
      expect(slots).not.toContain("2026-04-13T09:00:00.000Z");
      // 09:30 overlaps event → excluded
      expect(slots).not.toContain("2026-04-13T09:30:00.000Z");
      // 10:00 reserved 10:00-10:45 → busy period is 09:30-10:00 (not expanded) → no overlap → included
      expect(slots).toContain("2026-04-13T10:00:00.000Z");
    });

    it("no buffers behaves exactly as before", async () => {
      mockPrisma.availabilityRule.findFirst.mockResolvedValue({
        id: "rule-1", userId: "user-1", eventTypeId: null, dayOfWeek: 1,
        startTime: "09:00", endTime: "12:00", enabled: true,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        defaultBufferBeforeMinutes: 0, defaultBufferAfterMinutes: 0, applyBuffersToAllEvents: false,
      });
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const slots = await computeSlotsForPreview("user-1", 30, "2026-04-13");
      expect(slots).toHaveLength(6);
      expect(slots[0]).toBe("2026-04-13T09:00:00.000Z");
      expect(slots[slots.length - 1]).toBe("2026-04-13T11:30:00.000Z");
    });
  });
});
