import { FastifyInstance } from "fastify";

/**
 * Inbound mail webhook — TEMPORARY LOG-ONLY STAGE.
 *
 * The endpoint accepts a delivery, writes what arrived to the log and does
 * nothing else. It stores nothing, forwards nothing and changes no booking.
 *
 * It exists in this shape because the provider's payload and signature scheme
 * can only be learned from a real delivery: the header that carries the
 * signature is itself part of the payload we do not have. Signature
 * verification lands as soon as one delivery has been seen, and this comment
 * goes with it.
 *
 * Until then the endpoint is unauthenticated. The exposure is one log line per
 * request, bounded by the global rate limit.
 */

/** Header values worth seeing in full: transport metadata and anything that could carry a signature. */
const HEADER_VALUE_ALLOWED =
  /(^content-type$|^content-length$|^user-agent$|^date$|signature|sign|hmac|digest|timestamp|nonce|webhook|event|delivery|token|verify)/i;

/**
 * Keys whose values are mail content rather than protocol data — described,
 * never printed. Deliberately narrow: the first real delivery showed that this
 * provider puts the mail body under content.text and content.html, while
 * `message` and `content` are containers and other `message`-named fields
 * carry protocol information (spam.message explains why scoring was skipped).
 * Withholding those hid exactly what needed to be read.
 */
const CONTENT_KEYS = /^(html|htmlbody|html_body|text|textbody|text_body|body|raw|raw_email|rawemail|snippet|preview)$/i;

const MAX_SCALAR = 300;

/** Describe a value: protocol data verbatim, mail content by shape only. */
function describe(value: unknown, key = "", depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 7) return "<depth limit>";

  if (Array.isArray(value)) {
    return {
      __array: value.length,
      items: value.slice(0, 5).map((v) => describe(v, key, depth + 1)),
    };
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = describe(v, k, depth + 1);
    }
    return out;
  }

  if (typeof value === "string") {
    if (CONTENT_KEYS.test(key)) return `<string ${value.length} chars, withheld>`;
    if (value.length > MAX_SCALAR) return `<string ${value.length} chars, truncated> ${value.slice(0, MAX_SCALAR)}`;
    return value;
  }

  return value;
}

export async function mailInboundRoutes(app: FastifyInstance) {
  // Keep the raw bytes. The default JSON parser discards them, and a signature
  // is computed over the body as sent — reserialising a parsed object does not
  // reproduce it. Registered for the content types a mail provider may use.
  for (const type of ["application/json", "application/x-www-form-urlencoded", "text/plain", "*"]) {
    app.addContentTypeParser(type, { parseAs: "buffer" }, (_req, body, done) => {
      done(null, body);
    });
  }

  app.post(
    "/api/webhooks/mail-inbound",
    { bodyLimit: 25 * 1024 * 1024 },
    async (request, reply) => {
      const raw = request.body as Buffer | undefined;

      const headers: Record<string, unknown> = {};
      for (const [name, value] of Object.entries(request.headers)) {
        headers[name] = HEADER_VALUE_ALLOWED.test(name) ? value : "<present>";
      }

      let payload: unknown;
      let parsedAs = "none";
      if (raw && raw.length > 0) {
        const text = raw.toString("utf8");
        try {
          payload = describe(JSON.parse(text));
          parsedAs = "json";
        } catch {
          payload = text.length > 4000 ? `<${text.length} chars> ${text.slice(0, 4000)}` : text;
          parsedAs = "text";
        }
      }

      request.log.info(
        {
          inboundMail: {
            headerNames: Object.keys(request.headers),
            headers,
            bodyBytes: raw?.length ?? 0,
            parsedAs,
            payload,
          },
        },
        "[mail-inbound] delivery received (log-only stage)"
      );

      // The `return` matters: a bare reply.send() in an async handler lets
      // @fastify/compress finalise the response with an empty body.
      return reply.code(200).send({ ok: true });
    }
  );
}
