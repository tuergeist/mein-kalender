import { FastifyInstance } from "fastify";
import { createHash } from "crypto";
import { createMcpServer, StreamableHTTPServerTransport } from "../mcp-server";
import { prisma } from "../lib/prisma";

export async function mcpRoutes(app: FastifyInstance) {
  // MCP endpoint — stateless: each request gets a fresh server + transport
  // Auth via API token (mcp_...) — no JWT needed
  app.post("/api/mcp", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer mcp_")) {
      return reply.code(401).send({ error: "Unauthorized — Bearer mcp_<token> required" });
    }

    const token = authHeader.slice(7); // "mcp_..."
    const hash = createHash("sha256").update(token).digest("hex");

    const user = await prisma.user.findFirst({
      where: { mcpTokenHash: hash },
      select: { id: true },
    });

    if (!user) {
      return reply.code(401).send({ error: "Invalid API token" });
    }

    const mcpServer = createMcpServer(user.id);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    reply.hijack();

    reply.raw.on("close", () => {
      transport.close();
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  // GET/DELETE for MCP protocol completeness (stateless: not supported)
  app.get("/api/mcp", async (_request, reply) => {
    reply.code(405).send({ error: "Method not allowed (stateless mode)" });
  });

  app.delete("/api/mcp", async (_request, reply) => {
    reply.code(405).send({ error: "Method not allowed (stateless mode)" });
  });
}
