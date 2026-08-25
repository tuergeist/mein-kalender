import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import compress from "@fastify/compress";
import { mailInboundRoutes } from "./mail-inbound";

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  // The real server registers this globally, and it is what turns a bare
  // reply.send() in an async handler into an empty response body.
  await app.register(compress, { threshold: 0 });
  await app.register(mailInboundRoutes);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

async function post(payload: string, contentType = "application/json") {
  return app.inject({
    method: "POST",
    url: "/api/webhooks/mail-inbound",
    headers: { "content-type": contentType },
    payload,
  });
}

describe("inbound mail webhook (log-only stage)", () => {
  it("accepts a JSON delivery", async () => {
    const res = await post(JSON.stringify({ token: "abc", to: "t-x@reply.mcal.ink" }));
    expect(res.statusCode).toBe(200);
  });

  it("answers with a body even when the client accepts gzip", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/webhooks/mail-inbound",
      headers: { "content-type": "application/json", "accept-encoding": "gzip" },
      payload: JSON.stringify({ token: "abc" }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.length).toBeGreaterThan(0);
  });

  it("accepts a body that is not JSON", async () => {
    const res = await post("not json at all", "text/plain");
    expect(res.statusCode).toBe(200);
  });

  it("accepts an empty body", async () => {
    const res = await post("");
    expect(res.statusCode).toBe(200);
  });

  it("does not reject an unsigned request at this stage", async () => {
    // Deliberate: the signature scheme is unknown until a real delivery is
    // seen. This assertion is expected to be inverted when verification lands.
    const res = await post(JSON.stringify({ any: "thing" }));
    expect(res.statusCode).toBe(200);
  });
});
