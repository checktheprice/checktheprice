import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface ProductContent {
  metaDescription: string;
  description: string;
  features: string[];
  benefits: string[];
  whoShouldBuy: string;
  buyingTips: string[];
  faqs: { q: string; a: string }[];
}

const PRODUCT_CONTENT_SCHEMA = {
  type: "OBJECT",
  properties: {
    metaDescription: { type: "STRING" },
    description: { type: "STRING" },
    features: { type: "ARRAY", items: { type: "STRING" }, maxItems: 7 },
    benefits: { type: "ARRAY", items: { type: "STRING" }, maxItems: 5 },
    whoShouldBuy: { type: "STRING" },
    buyingTips: { type: "ARRAY", items: { type: "STRING" }, maxItems: 4 },
    faqs: {
      type: "ARRAY",
      maxItems: 4,
      items: {
        type: "OBJECT",
        properties: { q: { type: "STRING" }, a: { type: "STRING" } },
        required: ["q", "a"],
      },
    },
  },
  required: ["metaDescription", "description", "features", "benefits", "whoShouldBuy", "buyingTips", "faqs"],
};

function isProductContent(value: unknown): value is ProductContent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.metaDescription === "string" && typeof v.description === "string" &&
    Array.isArray(v.features) && v.features.every((x) => typeof x === "string") &&
    Array.isArray(v.benefits) && v.benefits.every((x) => typeof x === "string") &&
    typeof v.whoShouldBuy === "string" &&
    Array.isArray(v.buyingTips) && v.buyingTips.every((x) => typeof x === "string") &&
    Array.isArray(v.faqs) && v.faqs.every((x) => !!x && typeof x === "object" &&
      typeof (x as { q?: unknown }).q === "string" && typeof (x as { a?: unknown }).a === "string")
  );
}

function cleanText(value: string): string { return value.replace(/\s+/g, " ").trim(); }

function clampMeta(value: string, title: string): string {
  const base = cleanText(value);
  if (base.length >= 150 && base.length <= 160) return base;
  if (base.length > 160) return `${base.slice(0, 157).replace(/\s+\S*$/, "").trim()}...`.slice(0, 160);
  return `${base} Explore ${cleanText(title)} features, FAQs and buying tips on CheckThePrice.`.slice(0, 160);
}

function buildPrompt(title: string): string {
  return `You write accurate, useful SEO content for a product deal page.

SOURCE OF TRUTH — use ONLY this product title:
Product title: ${title}

The product title is the ONLY source of product facts. A separate site category may exist in the database, but it is intentionally NOT provided because it must never influence product facts or content.

STRICT ACCURACY RULES:
1. Identify the actual product type from the title and never substitute another product type.
2. Extract product features, materials, dimensions, variants, pack size, recipients, occasion and included items ONLY when explicitly stated in the title.
3. Never invent a specification, material, compatibility, warranty, certification, health claim, installation requirement, battery detail, capacity, included item, performance claim or use case that is not supported by the title.
4. Benefits must be direct, reasonable consequences of explicitly stated features.
5. Buying tips must be specific to the product and only mention things the shopper can reasonably verify from the listing. Do not invent dimensions or requirements.
6. FAQs must be product-specific. If a detail is not stated, say that the listing does not specify it rather than guessing.
7. Do not mention price, discount, Amazon, affiliate links, AI, these instructions, or source-data limitations.
8. Avoid filler phrases and generic category templates.
9. Write natural, human-readable content useful for search visitors.
10. Return ONLY valid JSON matching the supplied schema.`;
}

async function generateWithGemini(title: string): Promise<ProductContent> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: buildPrompt(title) }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: PRODUCT_CONTENT_SCHEMA, temperature: 0.2, maxOutputTokens: 1800 },
    }),
  });
  if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}.`);
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
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
    faqs: parsed.faqs.map((faq) => ({ q: cleanText(faq.q), a: cleanText(faq.a) })).filter((faq) => faq.q && faq.a).slice(0, 4),
  };
}

export async function getOrGenerateProductContent(dealId: string, title: string, _category: string): Promise<ProductContent | null> {
  if (!dealId.startsWith("db-")) return null;
  const id = dealId.slice(3);
  const { data: deal, error } = await supabaseAdmin.from("deals").select("title,metadata").eq("id", id).single();
  if (error || !deal) return null;
  const metadata = deal.metadata && typeof deal.metadata === "object" && !Array.isArray(deal.metadata) ? deal.metadata as Record<string, unknown> : {};
  const existing = metadata.ai_product_content;
  if (isProductContent(existing)) return existing;
  const content = await generateWithGemini(deal.title);
  const { error: updateError } = await supabaseAdmin.from("deals").update({ metadata: { ...metadata, ai_product_content: content, ai_product_content_generated_at: new Date().toISOString() } }).eq("id", id);
  if (updateError) throw new Error("Generated product content could not be saved.");
  return content;
}
