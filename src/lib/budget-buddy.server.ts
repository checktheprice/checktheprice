import { buildCompareBuyLink, resolveMerchant } from "@/lib/compare/merchants";
import {
  collectStoreEntries,
  serpApiGoogleShopping,
  serpApiImmersiveProduct,
  type SerpShoppingResult,
} from "@/lib/compare/serpapi.server";
import type { CompareOffer } from "@/lib/compare/types";
import type { BudgetBuddyOffer, BudgetBuddyResult } from "./budget-buddy.types";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

const ACCESSORY_RE =
  /\b(case|cover|charger|cable|screen protector|tempered glass|keyboard cover|bag|sleeve|stand|holder|replacement|spare|adapter|mount|skin|protector)\b/i;

function parsePrice(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function cleanQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ")
    .replace(/\bsmart[ -]?phone\b/i, "smartphone")
    .replace(/\bmobile phone\b/i, "smartphone")
    .slice(0, 160);
}

function isSupportedProductUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
    return ["amazon.in","flipkart.com","croma.com","reliancedigital.in","tatacliq.com","vijaysales.com","jiomart.com"]
      .some((domain) => host === domain || host.endsWith("." + domain));
  } catch { return false; }
}

function offerFromRaw(
  title: string, url: string, price: number, image: string | null,
  rating: number | null, reviews: number | null,
  reason: string | null, badge: string | null,
): BudgetBuddyOffer | null {
  if (!title || !url || !isSupportedProductUrl(url) || price <= 0 || ACCESSORY_RE.test(title)) return null;
  const { slug, label } = resolveMerchant(url, null);
  const base: CompareOffer = {
    storeRaw: label, store: label, merchant: slug, title: title.trim().slice(0, 220),
    price, priceLabel: `₹${Math.round(price).toLocaleString("en-IN")}`,
    shipping: null, offer: null, image: image || null, url,
    buyUrl: buildCompareBuyLink(slug, url),
    rating: typeof rating === "number" && rating >= 0 && rating <= 5 ? rating : null,
    reviews: typeof reviews === "number" && reviews >= 0 ? Math.round(reviews) : null,
  };
  return { ...base, reason, badge };
}

function dedupeOffers(offers: BudgetBuddyOffer[]): BudgetBuddyOffer[] {
  const seen = new Set<string>();
  return offers.filter((offer) => {
    let canonical = offer.url;
    try { const u = new URL(offer.url); u.search = ""; u.hash = ""; canonical = u.toString().replace(/\/$/, ""); } catch {}
    const key = `${offer.merchant}|${canonical}|${offer.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchWithGemini(query: string, budget: number): Promise<BudgetBuddyOffer[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const prompt = `Find real shopping products in India for: "${query}".
Hard budget: INR ${Math.round(budget)}. Every product MUST have a listed price at or below the budget.
Return 5-8 genuinely different MAIN PRODUCTS, preferably Amazon.in or Flipkart.com.
Exclude cases, covers, chargers, cables, protectors, replacement parts, bags, stands and other accessories.
Never invent product data. Use direct merchant product URLs, not Google URLs.
Prefer products with visible ratings/review counts. Give a short evidence-based reason.
Return JSON only: {"products":[{"title":"...","url":"https://...","price":9999,"rating":4.3,"reviews":1200,"image":"https://...","reason":"...","badge":"Best Overall"}]}.
Use null when a field is unavailable.`;

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return [];
    const body = await response.json() as { candidates?: Array<{content?: {parts?: Array<{text?: string}>}}> };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (!text) return [];
    const parsed = JSON.parse(text) as { products?: Array<Record<string, unknown>> };
    return (parsed.products ?? []).map((p) => offerFromRaw(
      typeof p.title === "string" ? p.title : "",
      typeof p.url === "string" ? p.url : "",
      parsePrice(p.price) ?? 0,
      typeof p.image === "string" ? p.image : null,
      typeof p.rating === "number" ? p.rating : null,
      typeof p.reviews === "number" ? p.reviews : null,
      typeof p.reason === "string" ? p.reason : null,
      typeof p.badge === "string" ? p.badge : null,
    )).filter((o): o is BudgetBuddyOffer => !!o).filter((o) => (o.price ?? Infinity) <= budget);
  } catch (error) {
    console.error("[budget-buddy] Gemini discovery failed", error);
    return [];
  }
}

function directMerchantUrl(r: SerpShoppingResult): string | null {
  for (const candidate of [r.direct_link, r.link, r.product_link]) {
    if (!candidate) continue;
    try { if (!/google\./i.test(new URL(candidate).hostname)) return candidate; } catch {}
  }
  return null;
}

async function resolveSerpMerchantUrl(r: SerpShoppingResult): Promise<string | null> {
  const direct = directMerchantUrl(r);
  if (direct) return direct;
  const api = r.serpapi_immersive_product_api;
  if (!api) return null;
  try {
    const token = new URL(api).searchParams.get("page_token");
    if (!token) return null;
    const body = await serpApiImmersiveProduct(token);
    if (body.error) return null;
    const stores = collectStoreEntries(body);
    const wanted = (r.source ?? "").toLowerCase();
    const match = stores.find((s) => {
      const url = s.direct_link || s.link || s.base_link;
      const name = (s.name || s.merchant || "").toLowerCase();
      return !!url && !/google\./i.test(url) && !!wanted && !!name && (name.includes(wanted) || wanted.includes(name));
    });
    return match?.direct_link || match?.link || match?.base_link || null;
  } catch { return null; }
}

async function searchWithSerpApi(query: string, budget: number): Promise<BudgetBuddyOffer[]> {
  const response = await serpApiGoogleShopping(`${query} under ₹${Math.round(budget)}`, { num: 40 });
  if (response.error) return [];
  const raw = [...(response.shopping_results ?? []), ...(response.inline_shopping_results ?? []), ...(response.immersive_products ?? [])]
    .filter((item) => (item.title ?? "").trim().length > 0).slice(0, 30);
  const resolved = await Promise.all(raw.map(async (item) => ({ item, url: await resolveSerpMerchantUrl(item) })));
  return resolved.map(({item,url}) => url ? offerFromRaw(
    item.title?.trim() ?? "", url, parsePrice(item.extracted_price ?? item.price) ?? 0,
    item.thumbnail ?? null, typeof item.rating === "number" ? item.rating : null,
    typeof item.reviews === "number" ? item.reviews : null, null, null
  ) : null).filter((o): o is BudgetBuddyOffer => !!o).filter((o) => (o.price ?? Infinity) <= budget);
}

function rank(offer: BudgetBuddyOffer, budget: number): number {
  const rating = offer.rating == null ? 0 : offer.rating / 5;
  const reviews = offer.reviews == null ? 0 : Math.min(Math.log10(offer.reviews + 1) / 6, 1);
  const value = Math.max(0, 1 - (offer.price ?? budget) / budget);
  return rating * 0.55 + reviews * 0.25 + value * 0.2;
}

export async function findBudgetBuddyProducts(rawQuery: string, rawBudget: number): Promise<BudgetBuddyResult> {
  const query = cleanQuery(rawQuery);
  const budget = Math.round(rawBudget);
  if (query.length < 2) return { query, budget, offers: [], source: "serpapi", error: "Tell us what product you are looking for." };
  if (!Number.isFinite(budget) || budget <= 0 || budget > 10000000) return { query, budget, offers: [], source: "serpapi", error: "Enter a valid budget." };

  let offers = await searchWithGemini(query, budget);
  let source: BudgetBuddyResult["source"] = "gemini";
  if (offers.length === 0) {
    offers = await searchWithSerpApi(query, budget);
    source = "serpapi";
  }
  offers = dedupeOffers(offers).filter((o) => o.price != null && o.price <= budget)
    .sort((a,b) => rank(b,budget) - rank(a,budget)).slice(0,5);
  return {
    query, budget, offers, source,
    error: offers.length ? null : `No suitable products found within ₹${budget.toLocaleString("en-IN")}.`,
  };
}
