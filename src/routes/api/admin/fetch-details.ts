/**
 * POST /api/admin/fetch-details
 *
 * Server-side Amazon India / Flipkart product scraper using the Firecrawl SDK.
 * Delegates all extraction logic to the shared scrape module so the Admin
 * import workflow and the Compare Prices feature stay in sync.
 *
 * Reads FIRECRAWL_API_KEY from environment variables only.
 * The apiKey field sent by the browser is intentionally ignored so the key
 * is never required on the client and is never echoed back.
 *
 * Returns: { merchant, standard_link, title, category, price, mrp, image, updated }
 */
import { createFileRoute } from "@tanstack/react-router";
import { scrapeProduct } from "@/lib/scrape/firecrawl.server";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/admin/fetch-details")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.FIRECRAWL_API_KEY;
        if (!apiKey) {
          return jsonResponse(
            {
              error:
                "FIRECRAWL_API_KEY is not configured. Add it in the server environment variables.",
            },
            500,
          );
        }

        let body: { url?: unknown; apiKey?: unknown };
        try {
          body = (await request.json()) as { url?: unknown; apiKey?: unknown };
        } catch {
          return jsonResponse({ error: "Invalid JSON body." }, 400);
        }

        const rawUrl =
          typeof body.url === "string" ? body.url.trim() : "";
        if (!rawUrl) {
          return jsonResponse({ error: "url is required." }, 400);
        }

        try {
          const p = await scrapeProduct(rawUrl);
          return jsonResponse({
            merchant: p.merchant,
            standard_link: p.standardLink,
            title: p.title,
            category: p.category,
            price: p.price,
            mrp: p.mrp,
            image: p.image,
            updated: new Date().toLocaleString("en-US", {
              timeZone: "Asia/Kolkata",
              hour12: false,
            }).replace(",", ""),
          });
        } catch (err) {
          const msg = (err as Error).message ?? "Firecrawl scrape failed.";
          const status =
            /is not configured|Not a valid|Not an amazon|no \/p\//.test(msg)
              ? 400
              : /could not be extracted/.test(msg)
                ? 422
                : 502;
          return jsonResponse({ error: msg }, status);
        }
      },
    },
  },
});
