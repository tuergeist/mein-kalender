import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";
import { getProvider } from "../providers";
import { encrypt } from "@calendar-sync/shared";

interface AuthenticatedRequest {
  user: AuthUser;
}

export async function oauthRoutes(app: FastifyInstance) {
  // Start OAuth flow — redirects user to provider consent screen
  app.get<{ Params: { provider: string }; Querystring: { redirect: string } }>(
    "/api/oauth/:provider/start",
    async (request, reply) => {
      const { provider } = request.params;
      const { redirect } = request.query;

      if (!["google", "outlook"].includes(provider)) {
        return reply.code(400).send({ error: "Unsupported provider" });
      }

      const p = getProvider(provider);
      const apiUrl = process.env.API_URL || "http://localhost:4200";
      const callbackUrl = redirect || `${apiUrl}/api/oauth/${provider}/callback`;
      const state = Buffer.from(
        JSON.stringify({ provider, redirect: callbackUrl })
      ).toString("base64url");

      const consentUrl = p.getConsentUrl(callbackUrl, state);
      return reply.redirect(consentUrl);
    }
  );

  // OAuth callback — exchanges code for tokens, redirects to web with tokens
  app.get<{
    Params: { provider: string };
    Querystring: { code?: string; state?: string; error?: string };
  }>(
    "/api/oauth/:provider/callback",
    async (request, reply) => {
      const { provider } = request.params;
      const { code, state, error } = request.query;

      if (error) {
        const webUrl = process.env.WEB_URL || "http://localhost:4201";
        return reply.redirect(`${webUrl}/settings?error=${encodeURIComponent(error)}`);
      }

      if (!code || !state) {
        return reply.code(400).send({ error: "Missing code or state" });
      }

      let stateData: { provider: string; redirect: string };
      try {
        stateData = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
      } catch {
        return reply.code(400).send({ error: "Invalid state" });
      }

      const p = getProvider(provider);
      const tokenSet = await p.authenticate({ code, redirectUri: stateData.redirect });

      // Redirect back to web app with tokens encoded in URL
      const webUrl = process.env.WEB_URL || "http://localhost:4201";
      const settingsUrl = new URL(`${webUrl}/settings/oauth-callback`);
      settingsUrl.searchParams.set("provider", provider);
      settingsUrl.searchParams.set(
        "tokens",
        Buffer.from(JSON.stringify(tokenSet)).toString("base64url")
      );

      return reply.redirect(settingsUrl.toString());
    }
  );

  // Complete OAuth — called by web app with auth token + provider tokens
  app.post<{
    Body: {
      provider: string;
      tokens: { accessToken: string; refreshToken: string | null; expiresAt: string | null };
    };
  }>(
    "/api/oauth/complete",
    { preHandler: authenticate },
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { provider, tokens } = request.body;

      if (!["google", "outlook"].includes(provider)) {
        return reply.code(400).send({ error: "Unsupported provider" });
      }

      const tokenSet = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt) : null,
      };

      // List calendars from provider
      const p = getProvider(provider);
      const calendars = await p.listCalendars(tokenSet);

      // Create source
      const source = await prisma.calendarSource.create({
        data: {
          userId: user.id,
          provider,
          label: provider === "outlook" ? "Microsoft 365" : "Google Calendar",
          credentials: encrypt(JSON.stringify(tokenSet), process.env.ENCRYPTION_SECRET!),
        },
      });

      // Create calendar entries
      for (const cal of calendars) {
        await prisma.calendarEntry.create({
          data: {
            sourceId: source.id,
            providerCalendarId: cal.providerCalendarId,
            name: cal.name,
            color: cal.color || "#7F77DD",
            readOnly: cal.readOnly,
          },
        });
      }

      return { sourceId: source.id, calendarsImported: calendars.length };
    }
  );
}
