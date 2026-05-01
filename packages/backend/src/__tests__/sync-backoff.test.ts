import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ProviderError, ProviderErrorCode } from "../errors";

// processSyncJob queues conflict detection / target sync via BullMQ on success;
// stub those out so the tests don't try to talk to Redis.
vi.mock("../queues", () => ({
  conflictQueue: { add: vi.fn().mockResolvedValue(undefined) },
  targetSyncQueue: { add: vi.fn().mockResolvedValue(undefined) },
  syncQueue: { add: vi.fn() },
  emailQueue: { add: vi.fn() },
}));

const mockProvider = {
  getEvents: vi.fn(),
};

vi.mock("../providers", () => ({
  getProvider: () => mockProvider,
}));

vi.mock("../encryption", () => ({
  decrypt: () =>
    JSON.stringify({ accessToken: "a", refreshToken: "r", expiresAt: null }),
}));

import { processSyncJob } from "../sync-job";

type SourceRow = {
  id: string;
  userId: string;
  provider: string;
  credentials: string;
  syncToken: string | null;
  fetchDaysInAdvance: number;
  icsUrl: string | null;
  consecutiveErrors: number;
  nextSyncAfter: Date | null;
  calendarEntries: Array<{ id: string; sourceId: string; providerCalendarId: string }>;
};

function makeSource(overrides: Partial<SourceRow> = {}): SourceRow {
  return {
    id: "src-1",
    userId: "user-1",
    provider: "outlook",
    credentials: "encrypted",
    syncToken: null,
    fetchDaysInAdvance: 90,
    icsUrl: null,
    consecutiveErrors: 0,
    nextSyncAfter: null,
    calendarEntries: [
      { id: "entry-1", sourceId: "src-1", providerCalendarId: "cal-1" },
    ],
    ...overrides,
  };
}

function buildPrismaMock(initialSource: SourceRow) {
  const updates: Array<Record<string, unknown>> = [];
  let current = { ...initialSource };
  const prisma = {
    calendarSource: {
      findFirst: vi.fn().mockImplementation(async () => current),
      update: vi.fn().mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => {
          updates.push(data);
          current = { ...current, ...data } as SourceRow;
          return current;
        }
      ),
    },
    event: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(undefined),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    targetEventMapping: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    syncHealth: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    booking: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue(undefined),
    },
    $transaction: vi.fn().mockImplementation(async (ops: Promise<unknown>[]) =>
      Promise.all(ops)
    ),
  };
  return { prisma, updates, snapshot: () => current };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-01T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("processSyncJob adaptive backoff", () => {
  it("early-returns and writes nothing when nextSyncAfter is in the future", async () => {
    const future = new Date("2026-05-01T12:05:00Z");
    const { prisma, updates } = buildPrismaMock(
      makeSource({ nextSyncAfter: future, consecutiveErrors: 3 })
    );

    await processSyncJob(prisma as never, "src-1", "user-1");

    expect(prisma.calendarSource.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.calendarSource.update).not.toHaveBeenCalled();
    expect(mockProvider.getEvents).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("proceeds when nextSyncAfter is in the past", async () => {
    const past = new Date("2026-05-01T11:00:00Z");
    const { prisma } = buildPrismaMock(
      makeSource({ nextSyncAfter: past, consecutiveErrors: 2 })
    );
    mockProvider.getEvents.mockResolvedValue({
      created: [],
      updated: [],
      deleted: [],
      nextSyncToken: null,
    });

    await processSyncJob(prisma as never, "src-1", "user-1");

    expect(mockProvider.getEvents).toHaveBeenCalledTimes(1);
  });

  it("increments consecutiveErrors and sets nextSyncAfter on RATE_LIMITED", async () => {
    const { prisma, updates } = buildPrismaMock(
      makeSource({ consecutiveErrors: 0 })
    );
    mockProvider.getEvents.mockRejectedValue(
      new ProviderError("rate limited", ProviderErrorCode.RATE_LIMITED, "outlook")
    );

    await expect(
      processSyncJob(prisma as never, "src-1", "user-1")
    ).rejects.toThrow();

    const errorUpdate = updates.find((u) => u.syncStatus === "error");
    expect(errorUpdate).toBeDefined();
    expect(errorUpdate!.consecutiveErrors).toBe(1);
    // 1st failure => baseDelay (60s) * 2^1 = 120s from now.
    const expected = new Date("2026-05-01T12:02:00Z");
    expect((errorUpdate!.nextSyncAfter as Date).getTime()).toBe(expected.getTime());
  });

  it("resets consecutiveErrors and clears nextSyncAfter on success", async () => {
    const { prisma, updates } = buildPrismaMock(
      makeSource({ consecutiveErrors: 4, nextSyncAfter: new Date("2026-05-01T11:30:00Z") })
    );
    mockProvider.getEvents.mockResolvedValue({
      created: [],
      updated: [],
      deleted: [],
      nextSyncToken: null,
    });

    await processSyncJob(prisma as never, "src-1", "user-1");

    const okUpdate = updates.find((u) => u.syncStatus === "ok");
    expect(okUpdate).toBeDefined();
    expect(okUpdate!.consecutiveErrors).toBe(0);
    expect(okUpdate!.nextSyncAfter).toBeNull();
  });

  it("caps the backoff at 30 minutes regardless of error count", async () => {
    const { prisma, updates } = buildPrismaMock(
      makeSource({ consecutiveErrors: 25 })
    );
    mockProvider.getEvents.mockRejectedValue(
      new ProviderError("rate limited", ProviderErrorCode.RATE_LIMITED, "outlook")
    );

    await expect(
      processSyncJob(prisma as never, "src-1", "user-1")
    ).rejects.toThrow();

    const errorUpdate = updates.find((u) => u.syncStatus === "error");
    expect(errorUpdate).toBeDefined();
    expect(errorUpdate!.consecutiveErrors).toBe(26);
    // Even though baseDelay * 2^26 vastly exceeds the cap, we expect exactly 30 min.
    const expected = new Date("2026-05-01T12:30:00Z");
    expect((errorUpdate!.nextSyncAfter as Date).getTime()).toBe(expected.getTime());
  });

  it("applies backoff to non-rate-limit errors too (e.g. transport failure)", async () => {
    const { prisma, updates } = buildPrismaMock(
      makeSource({ consecutiveErrors: 1 })
    );
    mockProvider.getEvents.mockRejectedValue(new TypeError("fetch failed"));

    await expect(
      processSyncJob(prisma as never, "src-1", "user-1")
    ).rejects.toThrow();

    const errorUpdate = updates.find((u) => u.syncStatus === "error");
    expect(errorUpdate).toBeDefined();
    expect(errorUpdate!.consecutiveErrors).toBe(2);
    // 2nd failure => 60s * 2^2 = 240s = 4 min.
    const expected = new Date("2026-05-01T12:04:00Z");
    expect((errorUpdate!.nextSyncAfter as Date).getTime()).toBe(expected.getTime());
  });
});
