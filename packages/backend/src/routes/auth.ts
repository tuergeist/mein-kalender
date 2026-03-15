import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = 12;

export async function authRoutes(app: FastifyInstance) {
  // Register
  app.post<{
    Body: { email: string; password: string; displayName?: string };
  }>("/api/auth/register", async (request, reply) => {
    const { email, password, displayName } = request.body;

    if (!email || !password) {
      return reply.code(400).send({ error: "Email and password are required" });
    }

    if (password.length < 8) {
      return reply.code(400).send({ error: "Password must be at least 8 characters" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: "An account with this email already exists. Please sign in instead." });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const skipVerification = process.env.SKIP_EMAIL_VERIFICATION === "true";

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: displayName || null,
        emailVerified: skipVerification,
      },
    });

    // TODO: Send verification email (task 3.7)

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
      };
    }

    // Check if a user with this email exists (link account)
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          displayName: name || null,
          emailVerified: true, // OAuth emails are pre-verified
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
    };
  });

  // Login (used by NextAuth credentials provider)
  app.post<{
    Body: { email: string; password: string };
  }>("/api/auth/login", async (request, reply) => {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.code(400).send({ error: "Invalid email or password" });
    }

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
    };
  });
}
