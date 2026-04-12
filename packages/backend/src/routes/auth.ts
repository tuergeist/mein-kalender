import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";
import { registerSchema, loginSchema, resendVerificationSchema, zodPreValidation } from "../lib/validators";
import { emailQueue } from "../queues";

const BCRYPT_ROUNDS = 12;

export async function authRoutes(app: FastifyInstance) {
  // Register
  app.post<{
    Body: { email: string; password: string; displayName?: string };
  }>("/api/auth/register", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } }, preValidation: zodPreValidation(registerSchema) }, async (request, reply) => {
    const { email, password, displayName } = request.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: "An account with this email already exists. Please sign in instead." });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const skipVerification = process.env.SKIP_EMAIL_VERIFICATION === "true";

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const emailVerificationToken = skipVerification ? null : crypto.randomUUID();
    const emailVerificationExpiresAt = skipVerification
      ? null
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: displayName || null,
        emailVerified: skipVerification,
        emailVerificationToken,
        emailVerificationExpiresAt,
        trialEndsAt,
      },
    });

    if (!skipVerification && emailVerificationToken) {
      const verifyUrl = `${process.env.APP_URL || "https://app.mein-kalender.link"}/api/auth/verify-email?token=${emailVerificationToken}`;
      emailQueue.add("send", {
        to: email,
        subject: "E-Mail-Adresse bestätigen — Mein Kalender",
        text: `Bitte bestätige deine E-Mail-Adresse:\n\n${verifyUrl}\n\nDer Link ist 24 Stunden gültig.`,
      }, { removeOnComplete: 100, removeOnFail: 50 }).catch((err) => console.error("[auth] Failed to queue verification email:", err));
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
    };
  });

  // OAuth user lookup/creation (used by NextAuth OAuth flow)
  app.post<{
    Body: {
      email: string;
      name?: string;
      provider: string;
      providerAccountId: string;
    };
  }>("/api/auth/oauth-user", async (request, reply) => {
    const { email, name, provider, providerAccountId } = request.body;

    if (!email || !provider || !providerAccountId) {
      return reply.code(400).send({ error: "Missing required fields" });
    }

    // Check if this OAuth account already exists
    const existingAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: { provider, providerAccountId },
      },
      include: { user: true },
    });

    if (existingAccount) {
      return {
        id: existingAccount.user.id,
        email: existingAccount.user.email,
        displayName: existingAccount.user.displayName,
        role: existingAccount.user.role,
      };
    }

    // Check if a user with this email exists (link account)
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      user = await prisma.user.create({
        data: {
          email,
          displayName: name || null,
          emailVerified: true, // OAuth emails are pre-verified
          trialEndsAt,
        },
      });
    }

    // Create the account link
    await prisma.account.create({
      data: {
        userId: user.id,
        type: "oauth",
        provider,
        providerAccountId,
      },
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  });

  // Login (used by NextAuth credentials provider)
  app.post<{
    Body: { email: string; password: string };
  }>("/api/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } }, preValidation: zodPreValidation(loginSchema) }, async (request, reply) => {
    const { email, password } = request.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    if (!user.emailVerified) {
      return reply.code(403).send({ error: "Please verify your email before signing in" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
    };
  });

  // Verify email
  app.get<{ Querystring: { token: string } }>(
    "/api/auth/verify-email",
    async (request, reply) => {
      const { token } = request.query;

      if (!token) {
        return reply.code(400).send({ error: "Missing verification token" });
      }

      const user = await prisma.user.findUnique({
        where: { emailVerificationToken: token },
      });

      if (!user) {
        return reply.code(400).send({ error: "Invalid verification token" });
      }

      if (user.emailVerificationExpiresAt && new Date() > user.emailVerificationExpiresAt) {
        return reply.code(400).send({ error: "Verification token has expired. Please request a new one." });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpiresAt: null,
        },
      });

      const loginUrl = `${process.env.APP_URL || "https://app.mein-kalender.link"}/auth/signin`;
      return reply.redirect(loginUrl);
    }
  );

  // Resend verification email
  app.post<{ Body: { email: string } }>(
    "/api/auth/resend-verification",
    { config: { rateLimit: { max: 1, timeWindow: "1 minute" } }, preValidation: zodPreValidation(resendVerificationSchema) },
    async (request, reply) => {
      const { email } = request.body;

      const user = await prisma.user.findUnique({ where: { email } });

      // Don't reveal whether the account exists
      if (!user || user.emailVerified) {
        return { message: "If an unverified account exists, a verification email has been sent." };
      }

      const emailVerificationToken = crypto.randomUUID();
      const emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerificationToken, emailVerificationExpiresAt },
      });

      const verifyUrl = `${process.env.APP_URL || "https://app.mein-kalender.link"}/api/auth/verify-email?token=${emailVerificationToken}`;
      emailQueue.add("send", {
        to: email,
        subject: "E-Mail-Adresse bestätigen — Mein Kalender",
        text: `Bitte bestätige deine E-Mail-Adresse:\n\n${verifyUrl}\n\nDer Link ist 24 Stunden gültig.`,
      }, { removeOnComplete: 100, removeOnFail: 50 }).catch((err) => console.error("[auth] Failed to queue verification email:", err));

      return { message: "If an unverified account exists, a verification email has been sent." };
    }
  );
}
