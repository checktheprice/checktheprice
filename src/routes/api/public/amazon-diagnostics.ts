/**
 * GET /api/public/amazon-diagnostics
 *
 * Read-only health check for the Amazon PA API integration.
 * Reports ONLY whether each credential is present (never its value) and the
 * raw status / error code Amazon returns for a single live GetItems probe.
 */
import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/amazon-diagnostics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const env = {
          AMAZON_ACCESS_KEY: Boolean(process.env.AMAZON_ACCESS_KEY),
          AMAZON_SECRET_KEY: Boolean(process.env.AMAZON_SECRET_KEY),
          AMAZON_PARTNER_TAG: Boolean(process.env.AMAZON_PARTNER_TAG),
          CRON_SECRET: Boolean(process.env.CRON_SECRET),
        };
        const config = {
          region: process.env.AMAZON_REGION ?? "eu-west-1",
          host: process.env.AMAZON_HOST ?? "webservices.amazon.in",
          partnerTagLength: (process.env.AMAZON_PARTNER_TAG ?? "").length,
        };

        const missing = Object.entries(env)
          .filter(([, present]) => !present)
          .map(([name]) => name);

        if (env.AMAZON_ACCESS_KEY === false || env.AMAZON_SECRET_KEY === false || env.AMAZON_PARTNER_TAG === false) {
          return json({ env, config, missing, probe: { skipped: "credentials missing" } });
        }

        const asin = new URL(request.url).searchParams.get("asin") ?? "B08N5WRWNW";
        if (!/^[A-Z0-9]{10}$/.test(asin)) return json({ error: "invalid asin" }, 400);

        try {
          const { getItems } = await import("@/lib/amazon/getItems");
          const items = await getItems([asin]);
          return json({
            env,
            config,
            missing,
            probe: { ok: true, asin, itemsReturned: items.length, sample: items[0] ?? null },
          });
        } catch (err) {
          const e = err as Error & { status?: number };
          return json({
            env,
            config,
            missing,
            probe: { ok: false, asin, status: e.status ?? null, amazonResponse: e.message },
          });
        }
      },
    },
  },
});
