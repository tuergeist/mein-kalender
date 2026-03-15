import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import { createSigner } from "fast-jwt";

const API_URL = process.env.API_URL || "http://localhost:4200";
const apiTokenSigner = createSigner({ key: process.env.NEXTAUTH_SECRET! });

async function findOrCreateOAuthUser(profile: {
  email: string;
  name?: string | null;
  provider: string;
  providerAccountId: string;
}) {
  // Try to find or create the user via the API
  const res = await fetch(`${API_URL}/api/auth/oauth-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });

  if (!res.ok) return null;
  return res.json();
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
    newUser: "/auth/signup",
  },
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });

        if (!res.ok) return null;

        const user = await res.json();
        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          image: user.avatarUrl,
          role: user.role,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    ...(process.env.MICROSOFT_CLIENT_ID
      ? [
          AzureADProvider({
            clientId: process.env.MICROSOFT_CLIENT_ID!,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
            tenantId: process.env.MICROSOFT_TENANT_ID || "common",
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth providers, find or create the user in our DB
      if (account && account.provider !== "credentials") {
        const dbUser = await findOrCreateOAuthUser({
          email: user.email!,
          name: user.name,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        });
        if (!dbUser) return false;
        // Store our DB user ID and role so jwt callback can use it
        user.id = dbUser.id;
        (user as any).role = dbUser.role;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.role = (user as any).role || "user";
      }
      // Sign API access token once and cache in JWT (persists across reads)
      if (!token.accessToken) {
        token.accessToken = apiTokenSigner({ sub: token.sub, email: token.email, role: token.role });
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.sub!;
      }
      (session as unknown as { accessToken: string }).accessToken =
        token.accessToken as string;
      (session as unknown as { role: string }).role =
        (token.role as string) || "user";
      return session;
    },
  },
};
