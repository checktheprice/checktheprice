/**
 * GET /api/public/cron/refresh-deals?limit=30
 *
 * Scheduled Amazon PA API price refresh. Gated by CRON_SECRET:
 *   Authorization: Bearer <CRON_SECRET>
 */
import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/cron/refresh-deals")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const auth = request.headers.get("Authorization") ?? "";
        if (!secret || auth !== `Bearer ${secret}`) {
          return json({ error: "unauthorized" }, 401);
        }

        const raw = new URL(request.url).searchParams.get("limit");
        const parsed = raw ? Number(raw) : 30;
        const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : 30;

        try {
          const { refreshBatch } = await import("@/lib/amazon/applyUpdate.server");
          return json(await refreshBatch(limit));
        } catch (err) {
          console.error("[cron refresh-deals] failed", err);
          return json({ error: (err as Error).message ?? "cron failed" }, 500);
        }
      },
    },
  },
});
