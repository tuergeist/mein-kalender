import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify from "fastify";
import { eventTypesRoutes } from "./event-types";

// Mock prisma
vi.mock("../lib/prisma", () => ({
  prisma: {
    eventType: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    availabilityRule: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock auth to inject a test user
vi.mock("../lib/auth", () => ({
  authenticate: async (request: any) => {
    request.user = { id: "user-1", email: "test@test.com", role: "user" };
  },
}));

// Mock public-booking (imported by event-types for preview)
vi.mock("./public-booking", () => ({
  computeSlotsForPreview: vi.fn().mockResolvedValue([]),
}));

import { prisma } from "../lib/prisma";

const mockPrisma = vi.mocked(prisma);

const mockEventType = {
  id: "et-1",
  userId: "user-1",
  name: "30-min Call",
  slug: "30-min-call",
  durationMinutes: 30,
  description: "A quick call",
  location: null,
  color: "#3b82f6",
  enabled: true,
  redirectUrl: null,
  redirectTitle: null,
  redirectDelaySecs: 5,
  bookingCalendarEntryId: null,
  shortHash: "abc12",
  createdAt: new Date(),
  calendars: [{ id: "cal-1", name: "Work" }],
  availabilityRules: [],
};

describe("event-types routes", () => {
  const app = Fastify();

  beforeAll(async () => {
    app.register(eventTypesRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/event-types/:id", () => {
    it("returns event type when found", async () => {
      mockPrisma.eventType.findFirst.mockResolvedValueOnce(mockEventType as any);

      const res = await app.inject({
        method: "GET",
        url: "/api/event-types/et-1",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe("et-1");
      expect(body.name).toBe("30-min Call");
      expect(body.calendars).toHaveLength(1);
      expect(mockPrisma.eventType.findFirst).toHaveBeenCalledWith({
        where: { id: "et-1", userId: "user-1" },
        include: {
          calendars: { select: { id: true, name: true } },
          availabilityRules: { orderBy: { dayOfWeek: "asc" } },
        },
      });
    });

    it("returns 404 when event type not found", async () => {
      mockPrisma.eventType.findFirst.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "GET",
        url: "/api/event-types/nonexistent",
      });

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body)).toEqual({ error: "Event type not found" });
    });

    it("scopes query to authenticated user", async () => {
      mockPrisma.eventType.findFirst.mockResolvedValueOnce(null);

      await app.inject({
        method: "GET",
        url: "/api/event-types/et-999",
      });

      expect(mockPrisma.eventType.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "et-999", userId: "user-1" },
        })
      );
    });
  });

  describe("PUT /api/event-types/:id", () => {
    it("returns 404 when event type not found", async () => {
      mockPrisma.eventType.findFirst.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "PUT",
        url: "/api/event-types/nonexistent",
        payload: { name: "Updated" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("updates basic fields", async () => {
      mockPrisma.eventType.findFirst.mockResolvedValueOnce(mockEventType as any);
      mockPrisma.eventType.update.mockResolvedValueOnce({ ...mockEventType, name: "Updated Call" } as any);

      const res = await app.inject({
        method: "PUT",
        url: "/api/event-types/et-1",
        payload: { name: "Updated Call", durationMinutes: 45 },
      });

      expect(res.statusCode).toBe(200);
      expect(mockPrisma.eventType.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "et-1" },
          data: expect.objectContaining({ name: "Updated Call", durationMinutes: 45 }),
        })
      );
    });

    it("upserts availability rules with correct composite key including eventTypeId", async () => {
      mockPrisma.eventType.findFirst.mockResolvedValueOnce(mockEventType as any);
      mockPrisma.eventType.update.mockResolvedValueOnce(mockEventType as any);
      mockPrisma.availabilityRule.upsert.mockResolvedValue({} as any);

      const rules = [
        { dayOfWeek: 1, startTime: "09:00", endTime: "17:00", enabled: true },
        { dayOfWeek: 2, startTime: "10:00", endTime: "18:00", enabled: true },
      ];

      const res = await app.inject({
        method: "PUT",
        url: "/api/event-types/et-1",
        payload: { availabilityRules: rules },
      });

      expect(res.statusCode).toBe(200);
      expect(mockPrisma.availabilityRule.upsert).toHaveBeenCalledTimes(2);

      // Verify the upsert uses the 3-part composite key (userId, eventTypeId, dayOfWeek)
      // This is critical: without eventTypeId, the unique constraint conflicts with default rules
      expect(mockPrisma.availabilityRule.upsert).toHaveBeenCalledWith({
        where: {
          userId_eventTypeId_dayOfWeek: {
            userId: "user-1",
            eventTypeId: "et-1",
            dayOfWeek: 1,
          },
        },
        create: {
          userId: "user-1",
          eventTypeId: "et-1",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "17:00",
          enabled: true,
        },
        update: {
          startTime: "09:00",
          endTime: "17:00",
          enabled: true,
        },
      });
    });
  });

  describe("GET /api/event-types", () => {
    it("returns all event types for authenticated user", async () => {
      mockPrisma.eventType.findMany.mockResolvedValueOnce([mockEventType] as any);

      const res = await app.inject({
        method: "GET",
        url: "/api/event-types",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(1);
      expect(mockPrisma.eventType.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "asc" },
        include: {
          calendars: { select: { id: true, name: true } },
          availabilityRules: { orderBy: { dayOfWeek: "asc" } },
        },
      });
    });
  });

  describe("DELETE /api/event-types/:id", () => {
    it("returns 404 when event type not found", async () => {
      mockPrisma.eventType.findFirst.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/event-types/nonexistent",
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
