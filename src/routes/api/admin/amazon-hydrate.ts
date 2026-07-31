/**
 * POST /api/admin/amazon-hydrate  { dealId: string }
 *
 * Enriches a freshly imported deal with live Amazon PA API data
 * (price, MRP, image, rating, availability, affiliate link).
 * Admin-only. Never fails the caller's import flow — errors are reported
 * in the response body and simply leave the existing row untouched.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/amazon-hydrate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAdmin, json } = await import("@/lib/amazon/require-admin.server");
        const guard = await requireAdmin(request);
        if (!guard.ok) return guard.response;

        let body: { dealId?: unknown };
        try {
          body = (await request.json()) as { dealId?: unknown };
        } catch {
          return json({ error: "Invalid JSON body." }, 400);
        }

        const dealId = typeof body.dealId === "string" ? body.dealId.trim() : "";
        if (!dealId) return json({ error: "dealId is required." }, 400);

        try {
          const { hydrateDeal } = await import("@/lib/amazon/applyUpdate.server");
          return json(await hydrateDeal(dealId));
        } catch (err) {
          console.error("[amazon-hydrate] failed", err);
          return json({ error: (err as Error).message ?? "hydrate failed" }, 502);
        }
      },
    },
  },
});
