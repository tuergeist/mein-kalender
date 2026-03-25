import Fastify from "fastify";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import multipart from "@fastify/multipart";
import bcrypt from "bcrypt";
import { validateEnv } from "./lib/env";
import { prisma } from "./lib/prisma";
import { healthRoutes } from "./routes/health";
import { sourcesRoutes } from "./routes/sources";
import { eventsRoutes } from "./routes/events";
import { syncRoutes } from "./routes/sync";
import { targetCalendarRoutes } from "./routes/target-calendar";
import { icsRoutes } from "./routes/ics";
import { authRoutes } from "./routes/auth";
import { oauthRoutes } from "./routes/oauth";
import { adminRoutes } from "./routes/admin";
import { eventTypesRoutes } from "./routes/event-types";
import { availabilityRoutes } from "./routes/availability";
import { bookingsRoutes } from "./routes/bookings";
import { profileRoutes } from "./routes/profile";
import { publicBookingRoutes } from "./routes/public-booking";
import { icsFeedsRoutes } from "./routes/ics-feeds";
import { icsServeRoutes } from "./routes/ics-serve";
import { userImageRoutes } from "./routes/user-images";
import { syncTargetsRoutes } from "./routes/sync-targets";

validateEnv();

const server = Fastify({ logger: true });

server.register(cors, { origin: true });
server.register(compress);
server.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
server.register(healthRoutes);
server.register(sourcesRoutes);
server.register(eventsRoutes);
server.register(syncRoutes);
server.register(targetCalendarRoutes);
server.register(icsRoutes);
server.register(authRoutes);
server.register(oauthRoutes);
server.register(adminRoutes);
server.register(eventTypesRoutes);
server.register(availabilityRoutes);
server.register(bookingsRoutes);
server.register(profileRoutes);
server.register(publicBookingRoutes);
server.register(icsFeedsRoutes);
server.register(icsServeRoutes);
server.register(userImageRoutes);
server.register(syncTargetsRoutes);

async function seedAdminUser() {
  const email = "admin@admin.local";
  const passwordHash = await bcrypt.hash("adminpass123", 12);
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, role: "admin", emailVerified: true },
  });
  // Clean up old admin user without valid email
  const oldAdmin = await prisma.user.findUnique({ where: { email: "admin" } });
  if (oldAdmin) {
    await prisma.user.delete({ where: { email: "admin" } });
  }
}

const start = async () => {
  const port = parseInt(process.env.SERVER_PORT || "4200", 10);
  const host = process.env.SERVER_HOST || "0.0.0.0";

  try {
    await seedAdminUser();
    await server.listen({ port, host });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
