import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";

interface AuthenticatedRequest {
  user: AuthUser;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function userImageRoutes(app: FastifyInstance) {
  // Upload avatar or background (authenticated)
  app.post<{ Params: { type: string }; Querystring: { skipUserUpdate?: string; scope?: string } }>(
    "/api/profile/image/:type",
    { preHandler: authenticate },
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { type } = request.params;
      const skipUserUpdate = request.query.skipUserUpdate === "true";
      const scope = request.query.scope || "";

      if (type !== "avatar" && type !== "background") {
        return reply.code(400).send({ error: "Type must be 'avatar' or 'background'" });
      }

      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ error: "No file uploaded" });
      }

      if (!ALLOWED_TYPES.includes(file.mimetype)) {
        return reply.code(400).send({ error: "File must be JPEG, PNG, WebP, or GIF" });
      }

      const chunks: Buffer[] = [];
      for await (const chunk of file.file) {
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks);

      if (data.length > MAX_SIZE) {
        return reply.code(400).send({ error: "File too large (max 5MB)" });
      }

      // Scope allows per-entity images (e.g., scope=et-{eventTypeId} for event types)
      // Without scope, upserts on userId+type (one image per type per user)
      const storageType = scope ? `${type}:${scope}` : type;

      const image = await prisma.userImage.upsert({
        where: { userId_type: { userId: user.id, type: storageType } },
        create: { userId: user.id, type: storageType, data, mimeType: file.mimetype },
        update: { data, mimeType: file.mimetype },
      });

      const imageUrl = `/api/public/image/${image.id}`;
      if (!skipUserUpdate) {
        if (type === "avatar") {
          await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: imageUrl } });
        } else {
          await prisma.user.update({ where: { id: user.id }, data: { backgroundUrl: imageUrl } });
        }
      }

      return { url: imageUrl };
    }
  );

  // Delete uploaded image (authenticated)
  app.delete<{ Params: { type: string } }>(
    "/api/profile/image/:type",
    { preHandler: authenticate },
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { type } = request.params;

      if (type !== "avatar" && type !== "background") {
        return reply.code(400).send({ error: "Type must be 'avatar' or 'background'" });
      }

      await prisma.userImage.deleteMany({ where: { userId: user.id, type } });

      if (type === "avatar") {
        await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
      } else {
        await prisma.user.update({ where: { id: user.id }, data: { backgroundUrl: null } });
      }

      return { success: true };
    }
  );

  // Serve image publicly (no auth — used by booking pages)
  app.get<{ Params: { id: string } }>(
    "/api/public/image/:id",
    async (request, reply) => {
      const { id } = request.params;

      const image = await prisma.userImage.findUnique({
        where: { id },
        select: { data: true, mimeType: true },
      });

      if (!image) {
        return reply.code(404).send({ error: "Image not found" });
      }

      reply
        .header("Content-Type", image.mimeType)
        .header("Cache-Control", "public, max-age=86400")
        .send(image.data);
    }
  );
}
