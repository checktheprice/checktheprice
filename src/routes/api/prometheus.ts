import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { buildAmazonAffiliateLink } from "@/lib/affiliate";
import { calcDiscount } from "@/lib/deals";

type WebhookPayload = {
  standard_link?: unknown;
  title?: unknown;
  category?: unknown;
  price?: unknown;
  mrp?: unknown;
  image?: unknown;
  updated?: unknown;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const n = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : n;
}

export const Route = createFileRoute("/api/prometheus")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Verify shared webhook secret to prevent unauthorised deal injection.
        // Set PROMETHEUS_WEBHOOK_SECRET in Replit Secrets and configure the
        // same value in the Prometheus webhook connection header X-Webhook-Secret.
        const expectedSecret = process.env.PROMETHEUS_WEBHOOK_SECRET;
        if (!expectedSecret) {
          console.error("[/api/prometheus] PROMETHEUS_WEBHOOK_SECRET env var is not set.");
          return jsonResponse({ error: "Webhook not configured." }, 500);
        }
        const providedSecret = request.headers.get("x-webhook-secret");
        if (!providedSecret || providedSecret !== expectedSecret) {
          return jsonResponse({ error: "Unauthorized." }, 401);
        }

        // Only accept JSON content
        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          return jsonResponse({ error: "Content-Type must be application/json." }, 415);
        }

        let body: WebhookPayload;
        try {
          body = (await request.json()) as WebhookPayload;
        } catch {
          return jsonResponse({ error: "Invalid JSON body." }, 400);
        }

        // Validate required fields
        const standard_link = body.standard_link ? String(body.standard_link).trim() : "";
        const title = body.title ? String(body.title).trim() : "";
        const price = toNumber(body.price);
        const mrp = toNumber(body.mrp);
        const image = body.image ? String(body.image).trim() : "";
        const category = body.category ? String(body.category).trim() : "General";

        const missing: string[] = [];
        if (!standard_link) missing.push("standard_link");
        if (!title) missing.push("title");
        if (!price) missing.push("price");
        if (!mrp) missing.push("mrp");
        if (!image) missing.push("image");

        if (missing.length > 0) {
          return jsonResponse(
            { error: `Missing required fields: ${missing.join(", ")}` },
            400,
          );
        }

        if (price <= 0) {
          return jsonResponse({ error: "price must be a positive number." }, 400);
        }
        if (mrp <= 0) {
          return jsonResponse({ error: "mrp must be a positive number." }, 400);
        }

        // Reuse the same affiliate link generation as the Publish Live flow
        const affiliate_link = buildAmazonAffiliateLink(standard_link);
        const discount_percentage = calcDiscount(mrp, price);

        // Use server-side Supabase admin client to bypass RLS
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        // Duplicate detection: reject if an active deal with the same standard_link already exists
        const { data: existing, error: lookupError } = await supabaseAdmin
          .from("deals")
          .select("id")
          .eq("standard_link", standard_link)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (lookupError) {
          console.error("[/api/prometheus] Duplicate check error:", lookupError);
          return jsonResponse({ error: `Database error: ${lookupError.message}` }, 500);
        }

        if (existing) {
          return jsonResponse(
            { error: "Duplicate: an active deal with this standard_link already exists.", id: existing.id },
            409,
          );
        }

        const { error } = await supabaseAdmin.from("deals").insert({
          title,
          image,
          category,
          price,
          mrp,
          discount_percentage,
          source: "Amazon",
          standard_link,
          affiliate_link,
          coupon_code: null,
          hot_deal: discount_percentage > 65,
          is_active: true,
          created_by: null,
        });

        if (error) {
          console.error("[/api/prometheus] Supabase insert error:", error);
          return jsonResponse(
            { error: `Database error: ${error.message}` },
            500,
          );
        }

        return jsonResponse({ ok: true }, 200);
      },
    },
  },
});
