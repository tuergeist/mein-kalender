import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OutlookCalendarProvider } from "../providers/outlook";
import { GoogleCalendarProvider } from "../providers/google";
import { ProviderError, ProviderErrorCode } from "../errors";
import type { TokenSet } from "../types";

const futureToken: TokenSet = {
  accessToken: "access",
  refreshToken: "refresh",
  expiresAt: new Date(Date.now() + 60_000),
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("Provider 429 Retry-After handling", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("Outlook listCalendars retries once after Retry-After delay on 429", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "1" },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ value: [] }));

    const provider = new OutlookCalendarProvider("client", "secret");
    const promise = provider.listCalendars(futureToken);

    // Advance through the Retry-After sleep (1s) so the second fetch fires.
    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("Outlook still throws RATE_LIMITED if second attempt also returns 429", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "1" },
        })
      )
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }));

    const provider = new OutlookCalendarProvider("client", "secret");
    const promise = provider.listCalendars(futureToken);
    promise.catch(() => {}); // attach handler so the rejection isn't unhandled

    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).rejects.toMatchObject({
      code: ProviderErrorCode.RATE_LIMITED,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("Outlook does not sleep when Retry-After is missing", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ value: [] }));

    const provider = new OutlookCalendarProvider("client", "secret");
    const promise = provider.listCalendars(futureToken);
    promise.catch(() => {});

    await expect(promise).rejects.toBeInstanceOf(ProviderError);
    // No Retry-After means we throw on the first 429 without retrying.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("Outlook does not sleep when Retry-After exceeds the cap", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "3600" }, // 1h, far above the 60s cap
        })
      )
      .mockResolvedValueOnce(jsonResponse({ value: [] }));

    const provider = new OutlookCalendarProvider("client", "secret");
    const promise = provider.listCalendars(futureToken);
    promise.catch(() => {});

    await expect(promise).rejects.toBeInstanceOf(ProviderError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("Google listCalendars retries once after Retry-After delay on 429", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "2" },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ items: [] }));

    const provider = new GoogleCalendarProvider("client", "secret");
    const promise = provider.listCalendars(futureToken);

    await vi.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
