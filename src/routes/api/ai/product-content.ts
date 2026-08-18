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
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return jsonResponse({ error: "AI not configured." }, 503);

        let body: { title?: unknown; category?: unknown; discountPct?: unknown };
        try { body = (await request.json()) as typeof body; } catch { return jsonResponse({ error: "Invalid JSON." }, 400); }

        const title = typeof body.title === "string" ? body.title.trim() : "";
        const category = typeof body.category === "string" ? body.category.trim() : "";
        const discountPct = typeof body.discountPct === "number" && Number.isFinite(body.discountPct) ? body.discountPct : 0;
        if (!title) return jsonResponse({ error: "title is required." }, 400);

        const prompt = `You write accurate product-page content for CheckThePrice.

SOURCE DATA (the only facts you may use):
Product title: ${title}
Site category: ${category || "Not specified"}
Discount shown by CheckThePrice: ${discountPct}%

STRICT RULES:
1. Treat the product title as the primary source of truth. Never invent specifications, materials, features, dimensions, compatibility, warranty, assembly, health claims, or included items.
2. The site category is metadata only. NEVER use it to invent a generic use case. For example, do not call a bean bag an LED product just because of a previous template, and do not say a Rakhi is for home/furniture use.
3. Extract the actual product type, attributes, variants, recipients, occasion, and included items from the title when stated.
4. If a detail is not stated, omit it or say that it is not specified in the listing. Do not guess.
5. Benefits must be reasonable consequences of stated features, not marketing inventions.
6. Buying tips must be relevant to this actual product. Do not add irrelevant installation, warranty, accessory, or dimension advice unless supported by the title.
7. FAQs must be specific to this product and must have real answers. Do not create blank answers.
8. Do not mention Amazon, AI, these instructions, or source-data limitations in the content unless necessary to say a detail is not specified.
9. Keep the writing natural, concise, and useful. Return only the requested JSON object.`;

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: PRODUCT_CONTENT_SCHEMA,
              },
            }),
          });
          if (!response.ok) return jsonResponse({ error: "AI request failed." }, 502);
          const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
          const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) return jsonResponse({ error: "AI returned no content." }, 502);
          const parsed = JSON.parse(text) as unknown;
          if (!validContent(parsed)) return jsonResponse({ error: "AI returned invalid content." }, 502);
          return jsonResponse({ content: parsed });
        } catch {
          return jsonResponse({ error: "AI request unavailable." }, 502);
        }
      },
    },
  },
});
