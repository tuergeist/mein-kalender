import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

// Authentifizierung überbrücken: hier geht es um die Weitergabe an Todoist,
// nicht um die Anmeldung.
vi.mock("../lib/auth", () => ({
  authenticate: async (request: { user?: unknown }) => {
    (request as { user: unknown }).user = { id: "u1", email: "demo@example.com", role: "user" };
  },
}));

import { feedbackRoutes } from "./feedback";

let app: FastifyInstance;
const calls: Array<{ url: string; init: RequestInit }> = [];

beforeEach(async () => {
  calls.length = 0;
  process.env.TODOIST_API_TOKEN = "test-token";
  app = Fastify();
  await app.register(feedbackRoutes);
  await app.ready();
});

afterEach(async () => {
  await app.close();
  vi.unstubAllGlobals();
});

function stubFetch(ok: boolean, status = 200) {
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok, status, text: async () => (ok ? "{}" : "deprecated") } as unknown as Response;
  });
}

async function submit(body: Record<string, unknown>) {
  return app.inject({ method: "POST", url: "/api/feedback", payload: body });
}

describe("feedback route", () => {
  it("posts to the current Todoist API version", async () => {
    stubFetch(true);
    const res = await submit({ type: "bug", title: "Etwas ist kaputt" });
    expect(res.statusCode).toBe(200);
    // Todoist hat rest/v2 abgeschaltet; die Adresse antwortete danach mit 410
    // und jede Meldung verschwand. Diese Zusicherung fängt genau das ab.
    expect(calls[0].url).toBe("https://api.todoist.com/api/v1/tasks");
  });

  it("files a bug in the bugs section and an idea in the features section", async () => {
    stubFetch(true);
    await submit({ type: "bug", title: "Etwas ist kaputt" });
    await submit({ type: "feature", title: "Etwas waere schoen" });
    const sections = calls.map((c) => JSON.parse(String(c.init.body)).section_id);
    expect(sections[0]).not.toBe(sections[1]);
  });

  it("reports a failure upstream instead of claiming success", async () => {
    // Der Auslöser des ganzen Ausfalls: Antwortet Todoist mit einem Fehler,
    // muss die Route ihn weiterreichen, damit die Oberfläche ihn zeigen kann.
    stubFetch(false, 410);
    const res = await submit({ type: "bug", title: "Etwas ist kaputt" });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toBeTruthy();
  });

  it("rejects a title that is too short without calling Todoist", async () => {
    stubFetch(true);
    const res = await submit({ type: "bug", title: "ab" });
    expect(res.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("reports missing configuration rather than failing silently", async () => {
    delete process.env.TODOIST_API_TOKEN;
    stubFetch(true);
    const res = await submit({ type: "bug", title: "Etwas ist kaputt" });
    expect(res.statusCode).toBe(500);
    expect(calls).toHaveLength(0);
  });
});
