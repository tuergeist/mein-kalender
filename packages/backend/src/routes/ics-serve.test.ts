import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import compress from "@fastify/compress";
import { icsServeRoutes } from "./ics-serve";

vi.mock("../lib/prisma", () => ({
  prisma: {
    icsFeed: { findUnique: vi.fn() },
    event: { findMany: vi.fn() },
  },
}));

import { prisma } from "../lib/prisma";

const mockPrisma = vi.mocked(prisma, true);

const feed = {
  id: "feed-1",
  token: "tok",
  userId: "user-1",
  name: "für proton",
  mode: "full",
  daysInAdvance: 60,
  calendars: [],
};

const events = [
  {
    sourceEventId: "abc123",
    title: "Max Ergo",
    description: null,
    location: "Hauptstraße 41, 04416 Markkleeberg, Deutschland",
    startTime: new Date("2026-08-20T13:00:00.000Z"),
    endTime: new Date("2026-08-20T13:45:00.000Z"),
    allDay: false,
    updatedAt: new Date("2026-08-18T09:30:00.000Z"),
  },
  {
    sourceEventId: "def456",
    title: "Homeoffice",
    description: "Leipzig wächst und mit der Stadt wächst ein Netzwerk aus Pionieren, das die Region trägt.\r\nZweite Zeile.",
    location: null,
    startTime: new Date("2026-08-21T00:00:00.000Z"),
    endTime: new Date("2026-08-22T00:00:00.000Z"),
    allDay: true,
    updatedAt: new Date("2026-08-19T07:00:00.000Z"),
  },
];

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  // The real server registers this globally. Without it the feed cannot be
  // tested against the empty-gzip-body failure. threshold 0 so the small
  // fixture feed is compressed too.
  await app.register(compress, { threshold: 0 });
  await app.register(icsServeRoutes);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.icsFeed.findUnique.mockResolvedValue(feed as never);
  mockPrisma.event.findMany.mockResolvedValue(events as never);
});

async function fetchFeed(): Promise<string> {
  const res = await app.inject({ method: "GET", url: "/api/ics-feed/tok.ics" });
  expect(res.statusCode).toBe(200);
  return res.body;
}

/** Reverse RFC 5545 folding: continuation lines start with a space or tab. */
function unfold(ics: string): string[] {
  const out: string[] = [];
  for (const line of ics.split("\r\n")) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out;
}

describe("ICS feed conformance", () => {
  it("uses CRLF throughout and terminates with one", async () => {
    const ics = await fetchFeed();
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "").includes("\n")).toBe(false);
    expect(ics.replace(/\r\n/g, "").includes("\r")).toBe(false);
  });

  it("keeps every physical line within 75 octets", async () => {
    const ics = await fetchFeed();
    const lines = ics.split("\r\n").filter((l) => l !== "");
    // The fixture has a description long enough to force folding.
    expect(lines.some((l) => Buffer.byteLength(l, "utf8") > 70)).toBe(true);
    for (const line of lines) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
  });

  it("gives every VEVENT the properties RFC 5545 requires", async () => {
    const lines = unfold(await fetchFeed());
    let inEvent = false;
    let props: string[] = [];
    let eventCount = 0;
    for (const line of lines) {
      if (line === "BEGIN:VEVENT") {
        inEvent = true;
        props = [];
      } else if (line === "END:VEVENT") {
        eventCount++;
        for (const required of ["UID", "DTSTAMP", "DTSTART"]) {
          expect(props, `VEVENT #${eventCount} is missing ${required}`).toContain(required);
        }
        inEvent = false;
      } else if (inEvent) {
        props.push(line.split(/[;:]/)[0]);
      }
    }
    expect(eventCount).toBe(events.length);
  });

  it("derives DTSTAMP from the event's last change, not the request time", async () => {
    const lines = unfold(await fetchFeed());
    expect(lines).toContain("DTSTAMP:20260818T093000Z");
    expect(lines).toContain("DTSTAMP:20260819T070000Z");
  });

  it("still delivers a body when the client accepts gzip", async () => {
    // Regression: a bare reply.send() in an async handler makes
    // @fastify/compress emit Content-Encoding: gzip with an empty body, so every
    // client that sends Accept-Encoding gets zero bytes. Proton Calendar refused
    // the feed for exactly this reason.
    const res = await app.inject({
      method: "GET",
      url: "/api/ics-feed/tok.ics",
      headers: { "accept-encoding": "gzip" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.length).toBeGreaterThan(0);
  });

  it("serves the feed inline, not as an attachment", async () => {
    // Proton Calendar rejects a subscription URL that answers with
    // Content-Disposition: attachment — same bytes without the header sync fine.
    const res = await app.inject({ method: "GET", url: "/api/ics-feed/tok.ics" });
    expect(res.headers["content-disposition"]).toBeUndefined();
    expect(res.headers["content-type"]).toBe("text/calendar; charset=utf-8");
  });

  it("omits METHOD, which would require ORGANIZER on every event", async () => {
    const lines = unfold(await fetchFeed());
    expect(lines.some((l) => l.startsWith("METHOD:"))).toBe(false);
  });

  it("nests BEGIN/END correctly and issues unique UIDs", async () => {
    const lines = unfold(await fetchFeed());
    const stack: string[] = [];
    for (const line of lines) {
      if (line.startsWith("BEGIN:")) stack.push(line.slice(6));
      else if (line.startsWith("END:")) expect(stack.pop()).toBe(line.slice(4));
    }
    expect(stack).toHaveLength(0);
    const uids = lines.filter((l) => l.startsWith("UID:"));
    expect(new Set(uids).size).toBe(uids.length);
  });

  it("escapes commas and line breaks inside property values", async () => {
    const lines = unfold(await fetchFeed());
    const location = lines.find((l) => l.startsWith("LOCATION:"))!;
    expect(location).toContain("Hauptstraße 41\\, 04416 Markkleeberg\\, Deutschland");
    const description = lines.find((l) => l.startsWith("DESCRIPTION:"))!;
    expect(description).toContain("\\nZweite Zeile.");
  });

  it("hides details in freebusy mode", async () => {
    mockPrisma.icsFeed.findUnique.mockResolvedValue({ ...feed, mode: "freebusy" } as never);
    const lines = unfold(await fetchFeed());
    expect(lines.some((l) => l.includes("Max Ergo"))).toBe(false);
    expect(lines.filter((l) => l === "SUMMARY:Busy")).toHaveLength(events.length);
  });

  it("returns 404 for an unknown token", async () => {
    mockPrisma.icsFeed.findUnique.mockResolvedValue(null as never);
    const res = await app.inject({ method: "GET", url: "/api/ics-feed/nope.ics" });
    expect(res.statusCode).toBe(404);
  });
});
