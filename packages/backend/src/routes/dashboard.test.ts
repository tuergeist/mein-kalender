import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

vi.mock("../lib/prisma", () => ({
  prisma: {
    event: { count: vi.fn() },
    conflict: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    calendarSource: { count: vi.fn(), findMany: vi.fn() },
    syncHealth: { findMany: vi.fn() },
    calendarEntry: { findMany: vi.fn() },
    targetEventMapping: { count: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock("../lib/auth", () => ({
  authenticate: async (request: any) => {
    request.user = { id: "user-1", email: "test@test.com", role: "user" };
  },
}));

import { prisma } from "../lib/prisma";
import { dashboardRoutes } from "./dashboard";

const mockPrisma = vi.mocked(prisma, true) as any;

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

async function summary(query: string) {
  const app = Fastify();
  await app.register(dashboardRoutes);
  const res = await app.inject({ method: "GET", url: `/api/dashboard/weekly-summary${query}` });
  await app.close();
  return res.json();
}

describe("weekly-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.event.count.mockResolvedValue(0);
    mockPrisma.conflict.count.mockResolvedValue(0);
    mockPrisma.calendarSource.count.mockResolvedValue(2);
  });

  it("berechnet die 24h-Metriken unabhängig vom gewählten Zeitraum", async () => {
    // Vier Zyklen: die beiden älteren sind fehlgeschlagen, die beiden aus den
    // letzten 24 Stunden liefen sauber.
    mockPrisma.syncHealth.findMany.mockResolvedValue([
      { checksumMatch: false, latencyMs: 900, createdAt: hoursAgo(70) },
      { checksumMatch: false, latencyMs: 800, createdAt: hoursAgo(50) },
      { checksumMatch: true, latencyMs: 100, createdAt: hoursAgo(10) },
      { checksumMatch: true, latencyMs: 200, createdAt: hoursAgo(2) },
    ]);

    const body = await summary("?period=30d");

    expect(body.syncCycles).toBe(4);
    expect(body.syncSuccessRate).toBe(50);
    expect(body.last24h).toEqual({
      syncCycles: 2,
      syncSuccessRate: 100,
      latency: { p50: 200, p95: 200 },
    });
  });

  it("meldet null Zyklen, wenn in 24h nicht synchronisiert wurde", async () => {
    mockPrisma.syncHealth.findMany.mockResolvedValue([
      { checksumMatch: true, latencyMs: 100, createdAt: hoursAgo(40) },
    ]);

    const body = await summary("?period=7d");

    expect(body.last24h.syncCycles).toBe(0);
  });

  it("nimmt für 7d ein rollendes Fenster, kein Fenster ab Wochenstart", async () => {
    mockPrisma.syncHealth.findMany.mockResolvedValue([]);

    const body = await summary("?period=7d");

    const start = new Date(body.periodStart).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(Date.now() - start).toBeGreaterThan(sevenDays - 60_000);
    expect(Date.now() - start).toBeLessThan(sevenDays + 60_000);
    // Der frühere Wochenstart lag sonntags in der Zukunft.
    expect(start).toBeLessThan(Date.now());
  });

  it("fragt die SyncHealth-Zyklen ab dem früheren der beiden Startpunkte ab", async () => {
    mockPrisma.syncHealth.findMany.mockResolvedValue([]);

    await summary("?period=24h");

    const where = mockPrisma.syncHealth.findMany.mock.calls[0][0].where;
    const cutoff = where.createdAt.gte as Date;
    // 24h ist der kürzeste Zeitraum, also liegt der Startpunkt bei 24h.
    expect(Date.now() - cutoff.getTime()).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(Date.now() - cutoff.getTime()).toBeLessThan(25 * 60 * 60 * 1000);
  });
});
