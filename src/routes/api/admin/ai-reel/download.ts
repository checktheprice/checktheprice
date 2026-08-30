import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/ai-reel/download")({
  server: { handlers: { POST: async ({ request }) => {
    const { requireAdmin, json } = await import("@/lib/amazon/require-admin.server");
    const guard = await requireAdmin(request);
    if (!guard.ok) return guard.response;
    const body = await request.json().catch(() => null) as { operationName?: string } | null;
    if (!body?.operationName) return json({ error: "operationName is required." }, 400);
    try {
      const { downloadGeneratedVideo } = await import("@/lib/ai-reel/gemini.server");
      return await downloadGeneratedVideo(body.operationName);
    } catch (err) {
      console.error("[ai-reel-download] failed", err);
      return json({ error: (err as Error).message || "Could not download generated reel." }, 502);
    }
  } } },
});
