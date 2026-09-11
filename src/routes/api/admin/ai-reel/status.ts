import { createFileRoute } from "@tanstack/react-router";
import { getVideoOperation, requireAdmin } from "@/lib/ai-reel/gemini.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/admin/ai-reel/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const admin = await requireAdmin(request);
        if (admin instanceof Response) return admin;

        const operation = new URL(request.url).searchParams.get("operation")?.trim();
        if (!operation) return json({ error: "operation is required." }, 400);

        try {
          const body = await getVideoOperation(operation);
          if (body.error) return json({ done: true, failed: true, error: body.error.message || "Video generation failed." });
          const done = !!body.done;
          const videoReady = !!body.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
          return json({
            done,
            failed: false,
            downloadUrl: done && videoReady
              ? `/api/admin/ai-reel/download?operation=${encodeURIComponent(operation)}`
              : undefined,
          });
        } catch (error) {
          return json({ error: (error as Error).message || "Could not check video status." }, 502);
        }
      },
    },
  },
});
