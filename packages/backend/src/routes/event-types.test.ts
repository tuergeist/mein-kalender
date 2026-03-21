import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
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

import { prisma } from "../lib/prisma";

const mockPrisma = vi.mocked(prisma);

describe("GET /api/event-types/:id", () => {
  const app = Fastify();

  beforeAll(async () => {
    app.register(eventTypesRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  it("returns event type when found", async () => {
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
