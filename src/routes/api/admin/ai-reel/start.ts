import { createFileRoute } from "@tanstack/react-router";
import { buildAIReelPrompt } from "@/lib/ai-reel/prompt";
import { requireAdmin, startVideoGeneration } from "@/lib/ai-reel/gemini.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/admin/ai-reel/start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const admin = await requireAdmin(request);
        if (admin instanceof Response) return admin;

        let body: { title?: unknown; category?: unknown; image?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "Invalid JSON body." }, 400);
        }

        const title = typeof body.title === "string" ? body.title.trim() : "";
        const category = typeof body.category === "string" ? body.category.trim() : "Other";
        const image = typeof body.image === "string" ? body.image.trim() : "";
        if (!title || !image) return json({ error: "Product title and image are required." }, 400);

        try {
          const prompt = buildAIReelPrompt(category, title);
          const operation = await startVideoGeneration(prompt, image);
          return json({ operation });
        } catch (error) {
          return json({ error: (error as Error).message || "Could not start video generation." }, 502);
        }
      },
    },
  },
});
