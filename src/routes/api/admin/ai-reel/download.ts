import { createFileRoute } from "@tanstack/react-router";
import { downloadGeneratedVideo, requireAdmin } from "@/lib/ai-reel/gemini.server";

export const Route = createFileRoute("/api/admin/ai-reel/download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const admin = await requireAdmin(request);
        if (admin instanceof Response) return admin;

        const operation = new URL(request.url).searchParams.get("operation")?.trim();
        if (!operation) {
          return new Response(JSON.stringify({ error: "operation is required." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        return downloadGeneratedVideo(operation);
      },
    },
  },
});
