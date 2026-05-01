import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ProviderError, ProviderErrorCode } from "../errors";

vi.mock("../queues", () => ({
  conflictQueue: { add: vi.fn().mockResolvedValue(undefined) },
  targetSyncQueue: { add: vi.fn().mockResolvedValue(undefined) },
  syncQueue: { add: vi.fn() },
  emailQueue: { add: vi.fn() },
}));

const mockProvider = {
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  getEvents: vi.fn(),
};

vi.mock("../providers", () => ({
  getProvider: () => mockProvider,
}));

vi.mock("../encryption", () => ({
  decrypt: () =>
    JSON.stringify({ accessToken: "a", refreshToken: "r", expiresAt: null }),
}));

import { cloneToTarget } from "../sync-job";

type StaleMapping = {
  id: string;
  targetEventId: string;
  lastSyncedAt: Date | null;
  sourceEvent: {
    title: string;
    description: string | null;
    location: string | null;
    startTime: Date;
    endTime: Date;
    allDay: boolean;
    updatedAt: Date;
  };
};

function makeStale(id: string): StaleMapping {
  return {
    id: `map-${id}`,
    targetEventId: `tgt-${id}`,
    lastSyncedAt: new Date("2026-04-01T00:00:00Z"),
    sourceEvent: {
      title: `Event ${id}`,
      description: null,
      location: null,
      startTime: new Date("2026-05-10T10:00:00Z"),
      endTime: new Date("2026-05-10T11:00:00Z"),
      allDay: false,
      updatedAt: new Date("2026-05-01T11:55:00Z"),
    },
  };
}

type SourceRow = {
  id: string;
  provider: string;
  credentials: string;
  nextSyncAfter: Date | null;
  consecutiveErrors: number;
};

function buildPrismaMock(opts: {
  staleMappings?: StaleMapping[];
  unmappedEvents?: Array<{
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    startTime: Date;
    endTime: Date;
    allDay: boolean;
    providerMetadata: Record<string, unknown> | null;
    ignored: boolean;
  }>;
  source?: Partial<SourceRow>;
}) {
  const source: SourceRow = {
    id: "src-1",
    provider: "outlook",
    credentials: "enc",
    nextSyncAfter: null,
    consecutiveErrors: 0,
    ...opts.source,
  };
  const sourceUpdates: Array<{ where: { id: string }; data: Record<string, unknown> }> = [];
  const mappingUpdates: string[] = [];

  const staleMappings = opts.staleMappings ?? [];
  const unmappedEvents = opts.unmappedEvents ?? [];

  const targetEntry = {
    id: "tgt-entry-1",
    providerCalendarId: "tgt-cal-1",
    syncMode: "full",
    syncDaysInAdvance: 90,
    skipWorkLocation: false,
    skipSingleDayAllDay: false,
    skipDeclined: false,
    skipFree: false,
    skipIgnored: false,
    markAsPrivate: false,
    source,
    sourceCalendars: [],
  };

  const prisma = {
    calendarEntry: {
      findMany: vi.fn().mockResolvedValue([targetEntry]),
    },
    calendarSource: {
      findUnique: vi.fn().mockImplementation(async () => ({
        nextSyncAfter: source.nextSyncAfter,
        consecutiveErrors: source.consecutiveErrors,
      })),
      update: vi.fn().mockImplementation(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          sourceUpdates.push({ where, data });
          if (typeof data.nextSyncAfter !== "undefined") {
            source.nextSyncAfter = data.nextSyncAfter as Date | null;
          }
          if (
            data.consecutiveErrors &&
            typeof data.consecutiveErrors === "object" &&
            "increment" in (data.consecutiveErrors as Record<string, number>)
          ) {
            source.consecutiveErrors += (data.consecutiveErrors as { increment: number }).increment;
          } else if (typeof data.consecutiveErrors === "number") {
            source.consecutiveErrors = data.consecutiveErrors;
          }
          return source;
        }
      ),
    },
    event: {
      findMany: vi.fn().mockResolvedValue(unmappedEvents),
    },
    targetEventMapping: {
      findMany: vi.fn().mockImplementation(async ({ include }: { include?: { sourceEvent?: unknown } }) => {
        if (include?.sourceEvent) {
          return staleMappings;
        }
        return [];
      }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
        mappingUpdates.push(where.id);
        return undefined;
      }),
    },
  };

  return { prisma, sourceUpdates, mappingUpdates, source };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-01T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cloneToSingleTarget circuit breaker", () => {
  it("aborts remaining update chunks on RATE_LIMITED and persists backoff on the target's source", async () => {
    const stale = [
      makeStale("a"),
      makeStale("b"),
      makeStale("c"),
      makeStale("d"),
      makeStale("e"),
      makeStale("f"),
      makeStale("g"),
    ];
    const { prisma, sourceUpdates } = buildPrismaMock({ staleMappings: stale });

    let call = 0;
    mockProvider.updateEvent.mockImplementation(async () => {
      call += 1;
      if (call === 2) {
        throw new ProviderError("rate limited", ProviderErrorCode.RATE_LIMITED, "outlook");
      }
      return undefined;
    });

    await cloneToTarget(prisma as never, "user-1");

    // Only the first chunk (5) should be attempted; chunks 2+ aborted.
    expect(mockProvider.updateEvent).toHaveBeenCalledTimes(5);
    expect(sourceUpdates).toHaveLength(1);
    expect(sourceUpdates[0].where.id).toBe("src-1");
    const data = sourceUpdates[0].data;
    expect(data.consecutiveErrors).toEqual({ increment: 1 });
    const expected = new Date("2026-05-01T12:05:00Z");
    expect((data.nextSyncAfter as Date).getTime()).toBe(expected.getTime());
  });

  it("preserves an existing later nextSyncAfter rather than shortening it", async () => {
    const farFuture = new Date("2026-05-01T13:00:00Z");
    const stale = [makeStale("a"), makeStale("b")];
    const { prisma, sourceUpdates } = buildPrismaMock({
      staleMappings: stale,
      source: { nextSyncAfter: farFuture },
    });

    mockProvider.updateEvent.mockRejectedValue(
      new ProviderError("rate limited", ProviderErrorCode.RATE_LIMITED, "outlook")
    );

    await cloneToTarget(prisma as never, "user-1");

    expect(sourceUpdates).toHaveLength(1);
    expect((sourceUpdates[0].data.nextSyncAfter as Date).getTime()).toBe(farFuture.getTime());
  });

  it("does NOT trip the breaker for non-429 errors and continues processing", async () => {
    const stale = [makeStale("a"), makeStale("b"), makeStale("c"), makeStale("d"), makeStale("e"), makeStale("f")];
    const { prisma, sourceUpdates } = buildPrismaMock({ staleMappings: stale });

    let call = 0;
    mockProvider.updateEvent.mockImplementation(async () => {
      call += 1;
      if (call === 2) {
        throw new Error("transient network blip");
      }
      return undefined;
    });

    await cloneToTarget(prisma as never, "user-1");

    // All 6 should be attempted: chunk 1 (5 calls, 1 failing) + chunk 2 (1 call).
    expect(mockProvider.updateEvent).toHaveBeenCalledTimes(6);
    expect(sourceUpdates).toHaveLength(0);
  });

  it("aborts the create-events loop on RATE_LIMITED and persists backoff", async () => {
    const unmapped = [
      { id: "e1", title: "E1", description: null, location: null, startTime: new Date("2026-05-10T10:00:00Z"), endTime: new Date("2026-05-10T11:00:00Z"), allDay: false, providerMetadata: null, ignored: false },
      { id: "e2", title: "E2", description: null, location: null, startTime: new Date("2026-05-10T12:00:00Z"), endTime: new Date("2026-05-10T13:00:00Z"), allDay: false, providerMetadata: null, ignored: false },
      { id: "e3", title: "E3", description: null, location: null, startTime: new Date("2026-05-10T14:00:00Z"), endTime: new Date("2026-05-10T15:00:00Z"), allDay: false, providerMetadata: null, ignored: false },
    ];
    const { prisma, sourceUpdates } = buildPrismaMock({ unmappedEvents: unmapped });

    let call = 0;
    mockProvider.createEvent.mockImplementation(async () => {
      call += 1;
      if (call === 2) {
        throw new ProviderError("rate limited", ProviderErrorCode.RATE_LIMITED, "outlook");
      }
      return { sourceEventId: `cloned-${call}` };
    });

    await cloneToTarget(prisma as never, "user-1");

    expect(mockProvider.createEvent).toHaveBeenCalledTimes(2);
    // Update phase must NOT run after the breaker trips.
    expect(mockProvider.updateEvent).not.toHaveBeenCalled();
    expect(sourceUpdates).toHaveLength(1);
    expect(sourceUpdates[0].data.consecutiveErrors).toEqual({ increment: 1 });
    expect((sourceUpdates[0].data.nextSyncAfter as Date).getTime()).toBe(
      new Date("2026-05-01T12:05:00Z").getTime()
    );
  });
});
