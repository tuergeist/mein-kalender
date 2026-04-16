import Fastify from "fastify";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { validateEnv } from "./lib/env";
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
import { dashboardRoutes } from "./routes/dashboard";
import { feedbackRoutes } from "./routes/feedback";
import { billingRoutes } from "./routes/billing";
import { mcpRoutes } from "./routes/mcp";

validateEnv();

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://app.mein-kalender.link,http://localhost:3000").split(",");

const server = Fastify({ logger: true });

server.register(cors, {
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error("Not allowed by CORS"), false);
    }
  },
});
server.register(compress);
server.register(rateLimit, { max: 100, timeWindow: "1 minute" });
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
server.register(dashboardRoutes);
server.register(feedbackRoutes);
server.register(billingRoutes);
server.register(mcpRoutes);

const start = async () => {
  const port = parseInt(process.env.SERVER_PORT || "4200", 10);
  const host = process.env.SERVER_HOST || "0.0.0.0";

  try {
    await server.listen({ port, host });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
