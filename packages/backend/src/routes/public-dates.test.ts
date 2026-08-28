import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

vi.mock("../lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    eventType: { findFirst: vi.fn() },
    booking: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    availabilityRule: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    event: { findMany: vi.fn() },
  },
}));
vi.mock("../encryption", () => ({ decrypt: vi.fn() }));
vi.mock("../providers", () => ({ getProvider: vi.fn() }));
vi.mock("../queues", () => ({ syncQueue: { add: vi.fn() }, emailQueue: { add: vi.fn() } }));
vi.mock("../lib/ics-invitation", () => ({ buildIcsInvitation: vi.fn() }));

import { publicBookingRoutes } from "./public-booking";

let app: FastifyInstance;

beforeEach(async () => {
  app = Fastify();
  await app.register(publicBookingRoutes);
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

/**
 * The date checks used to test only the shape, so an impossible day like
 * 2026-13-45 got through, became an Invalid Date and killed the handler with
 * a 500. These are public endpoints: a typo, or any scanner, would raise the
 * production alert.
 *
 * The routes are reached before any database call, so the mocks above never
 * have to answer — a 500 here means the guard let the value through.
 */
describe("public date parameters are rejected before they can crash a handler", () => {
  const badDates = ["2026-13-45", "9999-99-99", "2026-00-00", "0000-00-00"];
  const badMonths = ["2026-13", "2026-99", "0000-00", "2026-00"];

  for (const date of badDates) {
    it(`slots rejects date=${date}`, async () => {
      const res = await app.inject({ method: "GET", url: `/api/public/book/u/s/slots?date=${date}` });
      expect(res.statusCode).toBe(400);
    });
  }

  for (const month of badMonths) {
    it(`available-days rejects month=${month}`, async () => {
      const res = await app.inject({ method: "GET", url: `/api/public/book/u/s/available-days?month=${month}` });
      expect(res.statusCode).toBe(400);
    });
  }

  it("a real date is not rejected by the date guard", async () => {
    // Passes the guard, then fails to find the user — 404, not 400.
    const res = await app.inject({ method: "GET", url: "/api/public/book/u/s/slots?date=2026-09-15" });
    expect(res.statusCode).not.toBe(400);
  });

  it("the token-based routes guard their dates too", async () => {
    const slots = await app.inject({ method: "GET", url: "/api/public/booking/tok/slots?date=2026-13-45" });
    expect(slots.statusCode).toBe(400);
    const days = await app.inject({ method: "GET", url: "/api/public/booking/tok/available-days?month=2026-13" });
    expect(days.statusCode).toBe(400);
  });
});
