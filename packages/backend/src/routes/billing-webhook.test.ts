import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

vi.mock("../lib/prisma", () => ({
  prisma: { paymentEvent: { findUnique: vi.fn() }, user: { findFirst: vi.fn() } },
}));
vi.mock("../lib/auth", () => ({ authenticate: async () => {} }));
vi.mock("../lib/mollie", () => ({
  getOrCreateCustomer: vi.fn(),
  createFirstPayment: vi.fn(),
  getPayment: vi.fn(),
  cancelSubscription: vi.fn(),
  createSubscription: vi.fn(),
}));

import { billingRoutes } from "./billing";

let app: FastifyInstance;

beforeEach(async () => {
  app = Fastify();
  await app.register(billingRoutes);
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

/**
 * The webhook is public and unauthenticated. Anything that reaches it with
 * rubbish must come back as a client error — a 500 here does not just look
 * untidy, it raises the production alert on the first scanner that finds the
 * URL.
 */
describe("mollie webhook rejects bad input without a server error", () => {
  const cases: Array<[string, string | undefined, string]> = [
    ["empty body", undefined, "application/json"],
    ["empty JSON object", "{}", "application/json"],
    ["id of the wrong type", '{"id": 42}', "application/json"],
    ["null id", '{"id": null}', "application/json"],
  ];

  for (const [name, payload, contentType] of cases) {
    it(name + " yields 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/webhooks/mollie",
        headers: { "content-type": contentType },
        ...(payload === undefined ? {} : { payload }),
      });
      expect(res.statusCode).toBe(400);
    });
  }

  it("never answers a malformed request with 500", async () => {
    const res = await app.inject({ method: "POST", url: "/api/webhooks/mollie" });
    expect(res.statusCode).toBeLessThan(500);
  });
});
