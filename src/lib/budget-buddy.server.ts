import { buildCompareBuyLink, resolveMerchant } from "@/lib/compare/merchants";
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
Return 5-8 genuinely different MAIN PRODUCTS.
IMPORTANT MERCHANT COVERAGE: actively search BOTH Amazon.in and Flipkart.com. When both have relevant products within budget, include products from BOTH merchants (aim for at least 2 Amazon.in and 2 Flipkart.com results). Do not return only one merchant just because it appeared first.
Exclude cases, covers, chargers, cables, protectors, replacement parts, bags, stands and other accessories.
Never invent product data. Use direct merchant product URLs, not Google URLs. For Amazon results, the URL must be a real amazon.in product URL; for Flipkart results, the URL must be a real flipkart.com product URL.
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

function rank(offer: BudgetBuddyOffer, budget: number): number {
  const rating = offer.rating == null ? 0 : offer.rating / 5;
  const reviews = offer.reviews == null ? 0 : Math.min(Math.log10(offer.reviews + 1) / 6, 1);
  const value = Math.max(0, 1 - (offer.price ?? budget) / budget);
  return rating * 0.55 + reviews * 0.25 + value * 0.2;
}

export async function findBudgetBuddyProducts(rawQuery: string, rawBudget: number): Promise<BudgetBuddyResult> {
  const query = cleanQuery(rawQuery);
  const budget = Math.round(rawBudget);
  if (query.length < 2) return { query, budget, offers: [], source: "gemini", error: "Tell us what product you are looking for." };
  if (!Number.isFinite(budget) || budget <= 0 || budget > 10000000) return { query, budget, offers: [], source: "gemini", error: "Enter a valid budget." };

  const offers = await searchWithGemini(query, budget);
  const source: BudgetBuddyResult["source"] = "gemini";
  offers = dedupeOffers(offers).filter((o) => o.price != null && o.price <= budget)
    .sort((a,b) => rank(b,budget) - rank(a,budget)).slice(0,5);
  return {
    query, budget, offers, source,
    error: offers.length ? null : `No suitable products found within ₹${budget.toLocaleString("en-IN")}.`,
  };
}
