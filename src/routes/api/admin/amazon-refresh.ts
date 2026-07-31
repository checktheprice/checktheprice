/**
 * POST /api/admin/amazon-refresh
 *   { asins?: string[] }   -> raw PA API lookup (no writes)
 *   { limit?: number }     -> refresh the least-recently-checked deals
 *
 * Admin-only.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/amazon-refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAdmin, json } = await import("@/lib/amazon/require-admin.server");
        const guard = await requireAdmin(request);
        if (!guard.ok) return guard.response;

        let body: { asins?: unknown; limit?: unknown };
        try {
          body = (await request.json().catch(() => ({}))) as { asins?: unknown; limit?: unknown };
        } catch {
          return json({ error: "Invalid JSON body." }, 400);
        }

        try {
          if (Array.isArray(body.asins) && body.asins.length > 0) {
            const asins = body.asins
              .filter((a): a is string => typeof a === "string")
              .map((a) => a.trim().toUpperCase())
              .filter((a) => /^[A-Z0-9]{10}$/.test(a))
              .slice(0, 50);
            if (asins.length === 0) return json({ error: "No valid ASINs supplied." }, 400);
            const { getItems } = await import("@/lib/amazon/getItems");
            return json({ items: await getItems(asins) });
          }

          const limit = typeof body.limit === "number" && Number.isFinite(body.limit) ? body.limit : 30;
          const { refreshBatch } = await import("@/lib/amazon/applyUpdate.server");
          return json(await refreshBatch(limit));
        } catch (err) {
          console.error("[amazon-refresh] failed", err);
          return json({ error: (err as Error).message ?? "refresh failed" }, 502);
        }
      },
    },
  },
});
