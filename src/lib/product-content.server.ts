import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ProductContent } from "@/lib/deals";

const PRODUCT_CONTENT_SCHEMA = {
  type: "object",
  properties: {
    metaDescription: { type: "string" },
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
  required: [
    "metaDescription",
    "description",
    "features",
    "benefits",
    "whoShouldBuy",
    "buyingTips",
    "faqs",
  ],
  additionalProperties: false,
};

function isProductContent(value: unknown): value is ProductContent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.metaDescription === "string" &&
    typeof v.description === "string" &&
    Array.isArray(v.features) && v.features.every((x) => typeof x === "string") &&
    Array.isArray(v.benefits) && v.benefits.every((x) => typeof x === "string") &&
    typeof v.whoShouldBuy === "string" &&
    Array.isArray(v.buyingTips) && v.buyingTips.every((x) => typeof x === "string") &&
    Array.isArray(v.faqs) &&
    v.faqs.every(
      (x) =>
        !!x &&
        typeof x === "object" &&
        typeof (x as { q?: unknown }).q === "string" &&
        typeof (x as { a?: unknown }).a === "string",
    )
  );
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clampMeta(value: string, title: string): string {
  const base = cleanText(value);
  if (base.length >= 150 && base.length <= 160) return base;
  if (base.length > 160) {
    const shortened = base.slice(0, 157).replace(/\s+\S*$/, "").trim();
    return `${shortened}...`.slice(0, 160);
  }
  const suffix = ` Explore ${cleanText(title)} features, FAQs and buying tips on CheckThePrice.`;
  return `${base}${suffix}`.slice(0, 160);
}

function buildPrompt(title: string, category: string): string {
  return `You write accurate, useful SEO content for a product deal page.

SOURCE OF TRUTH — use ONLY these facts:
Product title: ${title}
Site category: ${category || "Not specified"}

STRICT ACCURACY RULES:
1. The product title is the primary source of truth.
2. Extract the actual product type, named features, materials, dimensions, variants, pack size, recipients, occasion and included items ONLY when explicitly stated in the title.
3. Never invent a specification, material, compatibility, warranty, certification, health claim, installation requirement, battery detail, capacity, included item, performance claim or use case that is not supported by the title.
4. The site category is only a label. Never use it to invent product characteristics or generic use cases.
5. Benefits must be direct, reasonable consequences of explicitly stated features.
6. Buying tips must be specific to the product and only mention things the shopper can reasonably verify from the listing. Do not invent dimensions or requirements.
7. FAQs must be product-specific. If a detail is not stated, say that the listing does not specify it rather than guessing.
8. Do not call the product a different product type than the title indicates.
9. Do not mention price, discount, Amazon, affiliate links, AI, these instructions, or source-data limitations.
10. Avoid filler phrases and generic category templates.
11. Write natural, human-readable content that is useful for search visitors.
12. Return ONLY valid JSON matching the supplied schema.`;
}

async function generateWithGemini(title: string, category: string): Promise<ProductContent> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(title, category) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: PRODUCT_CONTENT_SCHEMA,
          temperature: 0.2,
          maxOutputTokens: 1800,
        },
      }),
    },
  );

  if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}.`);
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content.");

  const parsed = JSON.parse(text) as unknown;
  if (!isProductContent(parsed)) throw new Error("Gemini returned invalid product content.");

  return {
    ...parsed,
    metaDescription: clampMeta(parsed.metaDescription, title),
    description: cleanText(parsed.description),
    features: parsed.features.map(cleanText).filter(Boolean).slice(0, 7),
    benefits: parsed.benefits.map(cleanText).filter(Boolean).slice(0, 5),
    whoShouldBuy: cleanText(parsed.whoShouldBuy),
    buyingTips: parsed.buyingTips.map(cleanText).filter(Boolean).slice(0, 4),
    faqs: parsed.faqs
      .map((faq) => ({ q: cleanText(faq.q), a: cleanText(faq.a) }))
      .filter((faq) => faq.q && faq.a)
      .slice(0, 4),
  };
}

export async function getOrGenerateProductContent(
  dealId: string,
  title: string,
  category: string,
): Promise<ProductContent | null> {
  if (!dealId.startsWith("db-")) return generateWithGemini(title, category);

  const id = dealId.slice(3);
  const { data: deal, error } = await supabaseAdmin
    .from("deals")
    .select("title,category,metadata")
    .eq("id", id)
    .single();

  if (error || !deal) return generateWithGemini(title, category);

  const metadata =
    deal.metadata && typeof deal.metadata === "object" && !Array.isArray(deal.metadata)
      ? (deal.metadata as Record<string, unknown>)
      : {};
  const existing = metadata.ai_product_content;
  if (isProductContent(existing)) return existing;

  const content = await generateWithGemini(deal.title, deal.category || category);
  const nextMetadata = {
    ...metadata,
    ai_product_content: content,
    ai_product_content_generated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabaseAdmin
    .from("deals")
    .update({ metadata: nextMetadata })
    .eq("id", id);

  if (updateError) throw new Error("Generated product content could not be saved.");
  return content;
}
