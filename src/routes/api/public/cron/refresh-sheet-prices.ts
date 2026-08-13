import { createFileRoute } from "@tanstack/react-router";
import { refreshSheetPrices } from "@/lib/sheet-price-refresh.server";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const Route = createFileRoute("/api/public/cron/refresh-sheet-prices")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const auth = request.headers.get("Authorization") ?? "";
        if (!secret || auth !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);
        try {
          return json(await refreshSheetPrices());
        } catch (error) {
          console.error("[cron refresh-sheet-prices] failed", error);
          return json({ error: error instanceof Error ? error.message : "sheet refresh failed" }, 500);
        }
      },
    },
  },
});
