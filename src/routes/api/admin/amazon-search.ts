/**
 * POST /api/admin/amazon-search  { keywords, searchIndex?, itemPage? }
 * Admin-only PA API SearchItems proxy. Read-only: writes nothing.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/amazon-search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAdmin, json } = await import("@/lib/amazon/require-admin.server");
        const guard = await requireAdmin(request);
        if (!guard.ok) return guard.response;

        let body: { keywords?: unknown; searchIndex?: unknown; itemPage?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "Invalid JSON body." }, 400);
        }

        const keywords = typeof body.keywords === "string" ? body.keywords.trim() : "";
        if (!keywords) return json({ error: "keywords is required." }, 400);

        try {
          const { searchItems } = await import("@/lib/amazon/searchItems");
          return json(
            await searchItems({
              keywords,
              searchIndex: typeof body.searchIndex === "string" ? body.searchIndex : undefined,
              itemPage: typeof body.itemPage === "number" ? body.itemPage : undefined,
            }),
          );
        } catch (err) {
          console.error("[amazon-search] failed", err);
          return json({ error: (err as Error).message ?? "search failed" }, 502);
        }
      },
    },
  },
});
