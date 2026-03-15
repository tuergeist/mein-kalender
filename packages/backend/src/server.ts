import Fastify from "fastify";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import { validateEnv } from "./lib/env";
import { healthRoutes } from "./routes/health";
import { sourcesRoutes } from "./routes/sources";
import { eventsRoutes } from "./routes/events";
import { syncRoutes } from "./routes/sync";
import { targetCalendarRoutes } from "./routes/target-calendar";
import { icsRoutes } from "./routes/ics";
import { authRoutes } from "./routes/auth";
import { oauthRoutes } from "./routes/oauth";

validateEnv();

const server = Fastify({ logger: true });

server.register(cors, { origin: true });
server.register(compress);
server.register(healthRoutes);
server.register(sourcesRoutes);
server.register(eventsRoutes);
server.register(syncRoutes);
server.register(targetCalendarRoutes);
server.register(icsRoutes);
server.register(authRoutes);
server.register(oauthRoutes);

const start = async () => {
  const port = parseInt(process.env.API_PORT || "4200", 10);
  const host = process.env.API_HOST || "0.0.0.0";

  try {
    await server.listen({ port, host });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
