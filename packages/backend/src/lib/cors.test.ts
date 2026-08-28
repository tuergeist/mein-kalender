import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { allowedOrigins, corsOrigin, DEFAULT_ALLOWED_ORIGINS } from "./cors";

let app: FastifyInstance;

beforeEach(async () => {
  app = Fastify();
  await app.register(cors, { origin: corsOrigin(allowedOrigins(undefined)) });
  app.post("/api/echo", async () => ({ ok: true }));
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

async function post(origin?: string) {
  return app.inject({
    method: "POST",
    url: "/api/echo",
    headers: origin ? { origin } : {},
    payload: {},
  });
}

describe("allowedOrigins", () => {
  it("carries the short link domain by default", () => {
    expect(DEFAULT_ALLOWED_ORIGINS).toContain("https://mcal.ink");
  });

  it("reads a comma separated environment value and trims it", () => {
    expect(allowedOrigins("https://a.example, https://b.example")).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });
});

describe("corsOrigin", () => {
  it("answers a POST from the short link domain", async () => {
    const res = await post("https://mcal.ink");
    expect(res.statusCode).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("https://mcal.ink");
  });

  it("answers a POST from the app itself", async () => {
    const res = await post("https://app.mein-kalender.link");
    expect(res.statusCode).toBe(200);
  });

  it("does not turn an unknown origin into a server error", async () => {
    const res = await post("https://evil.example");
    expect(res.statusCode).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers a request without an origin", async () => {
    const res = await post();
    expect(res.statusCode).toBe(200);
  });
});
