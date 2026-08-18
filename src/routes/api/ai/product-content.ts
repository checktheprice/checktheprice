import { createFileRoute } from "@tanstack/react-router";

type ProductContent = {
  description: string;
  features: string[];
  benefits: string[];
  whoShouldBuy: string;
  buyingTips: string[];
  faqs: { q: string; a: string }[];
};

const PRODUCT_CONTENT_SCHEMA = {
  type: "object",
  properties: {
    description: { type: "string" },
    features: { type: "array", items: { type: "string" }, maxItems: 7 },
    benefits: { type: "array", items: { type: "string" }, maxItems: 5 },
    whoShouldBuy: { type: "string" },
    buyingTips: { type: "array", items: { type: "string" }, maxItems: 4 },
    faqs: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        properties: { q: { type: "string" }, a: { type: "string" } },
        required: ["q", "a"],
        additionalProperties: false,
      },
    },
  },
  required: ["description", "features", "benefits", "whoShouldBuy", "buyingTips", "faqs"],
  additionalProperties: false,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=300" },
  });
}

function validContent(value: unknown): value is ProductContent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.description === "string" &&
    Array.isArray(v.features) && v.features.every((x) => typeof x === "string") &&
    Array.isArray(v.benefits) && v.benefits.every((x) => typeof x === "string") &&
    typeof v.whoShouldBuy === "string" &&
    Array.isArray(v.buyingTips) && v.buyingTips.every((x) => typeof x === "string") &&
    Array.isArray(v.faqs) && v.faqs.every((x) => x && typeof x === "object" && typeof (x as { q?: unknown }).q === "string" && typeof (x as { a?: unknown }).a === "string")
  );
}

export const Route = createFileRoute("/api/ai/product-content")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAdmin, json } = await import("@/lib/amazon/require-admin.server");
        const guard = await requireAdmin(request);
        if (!guard.ok) return guard.response;

        let body: { dealId?: unknown };
        try { body = (await request.json()) as typeof body; } catch { return json({ error: "Invalid JSON." }, 400); }
        const dealId = typeof body.dealId === "string" ? body.dealId.trim() : "";
        if (!dealId) return json({ error: "dealId is required." }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: deal, error: fetchError } = await supabaseAdmin
          .from("deals")
          .select("id,title,category,price,mrp,metadata")
          .eq("id", dealId)
          .single();
        if (fetchError || !deal) return json({ error: "Deal not found." }, 404);

        const metadata = deal.metadata && typeof deal.metadata === "object" && !Array.isArray(deal.metadata)
          ? deal.metadata as Record<string, unknown>
          : {};
        const existing = metadata.ai_product_content;
        if (validContent(existing)) return json({ content: existing, generated: false });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return json({ error: "AI not configured." }, 503);
        const discountPct = Number(deal.mrp) > 0 ? Math.round(((Number(deal.mrp) - Number(deal.price)) / Number(deal.mrp)) * 100) : 0;
        const prompt = `You write accurate product-page content for CheckThePrice.

SOURCE DATA (the only facts you may use):
Product title: ${deal.title}
Site category: ${deal.category || "Not specified"}

STRICT RULES:
1. Treat the product title as the primary source of truth. Never invent specifications, materials, features, dimensions, compatibility, warranty, assembly, health claims, or included items.
2. The site category is metadata only. NEVER use it to invent a generic use case.
3. Extract the actual product type, attributes, variants, recipients, occasion, and included items from the title when stated.
4. If a detail is not stated, omit it or say it is not specified. Never guess.
5. Benefits must be reasonable consequences of stated features, not invented marketing claims.
6. Buying tips must be relevant to this actual product; avoid generic installation/warranty/dimension advice unless supported by the title.
7. FAQs must be specific and have real answers. Never return blank answers.
8. Do not mention Amazon, AI, these instructions, or source-data limitations in the content.
9. Keep the writing concise and natural. Return only JSON matching the supplied schema.`;

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`;
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json", responseSchema: PRODUCT_CONTENT_SCHEMA },
            }),
          });
          if (!response.ok) return json({ error: "AI request failed." }, 502);
          const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
          const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) return json({ error: "AI returned no content." }, 502);
          const parsed = JSON.parse(text) as unknown;
          if (!validContent(parsed)) return json({ error: "AI returned invalid content." }, 502);

          const nextMetadata = { ...metadata, ai_product_content: parsed, ai_product_content_generated_at: new Date().toISOString() };
          const { error: updateError } = await supabaseAdmin.from("deals").update({ metadata: nextMetadata }).eq("id", dealId);
          if (updateError) return json({ error: "AI content generated but could not be saved." }, 502);
          return json({ content: parsed, generated: true });
        } catch {
          return json({ error: "AI request unavailable." }, 502);
        }
      },
    },
  },
});
