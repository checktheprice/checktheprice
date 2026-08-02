/**
 * POST /api/admin/amazon-variations  { asin, page? }
 * Admin-only Creators API GetVariations proxy. Read-only: writes nothing.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/amazon-variations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAdmin, json } = await import("@/lib/amazon/require-admin.server");
        const guard = await requireAdmin(request);
        if (!guard.ok) return guard.response;

        let body: { asin?: unknown; page?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "Invalid JSON body." }, 400);
        }

        const asin = typeof body.asin === "string" ? body.asin.trim().toUpperCase() : "";
        if (!/^[A-Z0-9]{10}$/.test(asin)) return json({ error: "A valid asin is required." }, 400);

        try {
          const { getVariations } = await import("@/lib/amazon/getVariations");
          return json(await getVariations(asin, typeof body.page === "number" ? body.page : 1));
        } catch (err) {
          console.error("[amazon-variations] failed", err);
          return json({ error: (err as Error).message ?? "variations failed" }, 502);
        }
      },
    },
  },
});
