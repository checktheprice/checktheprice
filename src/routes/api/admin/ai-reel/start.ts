import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/ai-reel/start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAdmin, json } = await import("@/lib/amazon/require-admin.server");
        const guard = await requireAdmin(request);
        if (!guard.ok) return guard.response;
        let body: { product?: unknown };
        try { body = (await request.json()) as typeof body; } catch { return json({ error: "Invalid JSON body." }, 400); }
        const product = body.product as Record<string, unknown> | undefined;
        if (!product || typeof product.title !== "string" || typeof product.image !== "string") {
          return json({ error: "A product with title and image is required." }, 400);
        }
        try {
          const { startReelGeneration } = await import("@/lib/ai-reel/gemini.server");
          return json(await startReelGeneration({
            id: String(product.id || ""),
            title: product.title,
            image: product.image,
            category: typeof product.category === "string" ? product.category : "Other",
            price: Number(product.price || 0),
            mrp: product.mrp == null ? null : Number(product.mrp),
            discount_percentage: product.discount_percentage == null ? null : Number(product.discount_percentage),
            source: typeof product.source === "string" ? product.source : null,
            standard_link: typeof product.standard_link === "string" ? product.standard_link : null,
            affiliate_link: typeof product.affiliate_link === "string" ? product.affiliate_link : null,
          }));
        } catch (err) {
          console.error("[ai-reel-start] failed", err);
          return json({ error: (err as Error).message || "AI reel generation failed." }, 502);
        }
      },
    },
  },
});
