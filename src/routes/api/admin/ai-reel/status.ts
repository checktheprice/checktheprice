import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/ai-reel/status")({
  server: { handlers: { POST: async ({ request }) => {
    const { requireAdmin, json } = await import("@/lib/amazon/require-admin.server");
    const guard = await requireAdmin(request);
    if (!guard.ok) return guard.response;
    const body = await request.json().catch(() => null) as { operationName?: string } | null;
    if (!body?.operationName) return json({ error: "operationName is required." }, 400);
    try {
      const { getReelOperation, getVideoUri } = await import("@/lib/ai-reel/gemini.server");
      const operation = await getReelOperation(body.operationName);
      const error = operation.error as { message?: string } | undefined;
      return json({ done: !!operation.done, failed: !!error, error: error?.message, hasVideo: !!getVideoUri(operation) });
    } catch (err) {
      console.error("[ai-reel-status] failed", err);
      return json({ error: (err as Error).message || "Could not check reel status." }, 502);
    }
  } } },
});
