import { FastifyRequest, FastifyReply } from "fastify";
import { createVerifier } from "fast-jwt";

let verifier: ReturnType<typeof createVerifier> | null = null;

function getVerifier() {
  if (!verifier) {
    verifier = createVerifier({ key: process.env.NEXTAUTH_SECRET! });
  }
  return verifier;
}

export interface AuthUser {
  id: string;
  email: string;
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const payload = getVerifier()(token);
    (request as FastifyRequest & { user: AuthUser }).user = {
      id: payload.sub,
      email: payload.email,
    };
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
  }
}
