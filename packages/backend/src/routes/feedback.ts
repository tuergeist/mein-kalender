import { FastifyInstance } from "fastify";
import { authenticate, AuthUser } from "../lib/auth";

interface AuthenticatedRequest {
  user: AuthUser;
}

// api/v1, nicht rest/v2: Todoist hat die v2-Adresse abgeschaltet, sie antwortet
// seitdem mit 410 "This endpoint is deprecated". Die Nutzlast ist unverändert —
// gegen die echte Schnittstelle geprüft: content, description, project_id,
// section_id, labels und priority werden gleich verarbeitet.
const TODOIST_API = "https://api.todoist.com/api/v1";
const PROJECT_ID = "6gFMx58H5p8Q9Xcv";
const BUGS_SECTION_ID = "6gFP56GqqMhm4pqM";
const FEATURES_SECTION_ID = "6gFP55v8gm95h8qM";

export async function feedbackRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.post<{
    Body: { type: "bug" | "feature"; title: string; description?: string };
  }>("/api/feedback", async (request, reply) => {
    const { user } = request as unknown as AuthenticatedRequest;
    const { type, title, description } = request.body;

    if (!title || title.trim().length < 3) {
      return reply.code(400).send({ error: "Titel muss mindestens 3 Zeichen haben." });
    }

    const todoistToken = process.env.TODOIST_API_TOKEN;
    if (!todoistToken) {
      console.error("[feedback] TODOIST_API_TOKEN not configured");
      return reply.code(500).send({ error: "Feedback-System nicht konfiguriert." });
    }

    const sectionId = type === "bug" ? BUGS_SECTION_ID : FEATURES_SECTION_ID;
    const content = `[App] ${title}`;
    const desc = [
      description || "",
      "",
      `---`,
      `Gemeldet von: ${user.email}`,
      `Typ: ${type === "bug" ? "Bug" : "Feature-Wunsch"}`,
      `Datum: ${new Date().toISOString()}`,
    ].join("\n");

    const res = await fetch(`${TODOIST_API}/tasks`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${todoistToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        description: desc,
        project_id: PROJECT_ID,
        section_id: sectionId,
        labels: ["app-reported"],
        priority: type === "bug" ? 3 : 1, // Todoist: 3 = p2, 1 = p4
      }),
    });

    if (!res.ok) {
      console.error("[feedback] Todoist API error:", await res.text());
      return reply.code(500).send({ error: "Feedback konnte nicht gesendet werden." });
    }

    return { success: true };
  });
}
