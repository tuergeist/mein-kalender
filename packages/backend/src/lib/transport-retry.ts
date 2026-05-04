// Single-shot retry for transient undici/fetch transport failures.
// In production we observe ~10% of Google sync ticks failing with
// `TypeError: fetch failed` (DNS hiccup, ECONNRESET mid-handshake, etc.).
// One quick retry catches the dominant pattern; persistent failures still
// fall through to the per-source adaptive backoff in sync-job.ts.

const TRANSIENT_RETRY_DELAY_MS = 500;

const TRANSIENT_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EPIPE",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_CLOSED",
]);

export function isTransientTransportError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // undici wraps the underlying socket error as `cause`; the outer error is a
  // plain TypeError with message "fetch failed". Check both layers.
  const codeOf = (e: unknown): string | undefined => {
    if (e && typeof e === "object" && "code" in e) {
      const c = (e as { code?: unknown }).code;
      if (typeof c === "string") return c;
    }
    return undefined;
  };
  if (err.name === "TypeError" && err.message === "fetch failed") return true;
  const outerCode = codeOf(err);
  if (outerCode && TRANSIENT_CODES.has(outerCode)) return true;
  const cause = (err as Error & { cause?: unknown }).cause;
  const causeCode = codeOf(cause);
  if (causeCode && TRANSIENT_CODES.has(causeCode)) return true;
  return false;
}

export async function fetchWithTransportRetry(
  doFetch: () => Promise<Response>
): Promise<Response> {
  try {
    return await doFetch();
  } catch (err) {
    if (!isTransientTransportError(err)) throw err;
    await new Promise((r) => setTimeout(r, TRANSIENT_RETRY_DELAY_MS));
    return doFetch();
  }
}
