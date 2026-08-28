/**
 * Origins the browser may read an API answer from.
 *
 * `https://mcal.ink` belongs here even though it is served by the same nginx:
 * a browser sends `Origin` on every request that is not GET or HEAD, its own
 * included, so the booking POST from a short link arrives here carrying
 * mcal.ink and has to be recognised.
 */
export const DEFAULT_ALLOWED_ORIGINS = [
  "https://app.mein-kalender.link",
  "https://mcal.ink",
  "http://localhost:3000",
];

export function allowedOrigins(env = process.env.ALLOWED_ORIGINS): string[] {
  if (!env) return DEFAULT_ALLOWED_ORIGINS;
  return env.split(",").map((o) => o.trim()).filter(Boolean);
}

/**
 * The origin delegate for @fastify/cors.
 *
 * An unknown origin is refused by withholding the header, not by failing.
 * Handing the callback an Error turns the request into a 500, and since the
 * 500 alert exists that lets anyone trigger mail with one curl.
 */
export function corsOrigin(allowed: string[]) {
  return (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
    cb(null, !origin || allowed.includes(origin));
  };
}
