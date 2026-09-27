import { buildCompareBuyLink, resolveMerchant } from "@/lib/compare/merchants";
import type { CompareOffer } from "@/lib/compare/types";
import type { BudgetBuddyOffer, BudgetBuddyResult } from "./budget-buddy.types";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";
const GEMINI_TIMEOUT_MS = 20_000;

type BudgetBuddyMerchant = "amazon" | "flipkart";

type GroundingChunk = {
  web?: {
    uri?: string;
    title?: string;
  };
};

type GroundingSupport = {
  segment?: {
    startIndex?: number;
    endIndex?: number;
    text?: string;
  };
  groundingChunkIndices?: number[];
};

type GroundingMetadata = {
  groundingChunks?: GroundingChunk[];
  groundingSupports?: GroundingSupport[];
};

type GeminiCandidate = {
  content?: {
    parts?: Array<{ text?: string }>;
  };
  groundingMetadata?: GroundingMetadata;
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
};

type RawProduct = Record<string, unknown>;

type GroundedSource = {
  index: number;
  url: string;
  title: string;
  evidence: string;
};

type GeminiSearchResult = {
  offers: BudgetBuddyOffer[];
  error: string | null;
};

function parsePrice(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseRating(value: unknown): number | null {
  const parsed = parsePrice(value);
  return parsed !== null && parsed <= 5 ? parsed : null;
}

function parseReviews(value: unknown): number | null {
  const parsed = parsePrice(value);
  return parsed !== null ? Math.round(parsed) : null;
}

function cleanQuery(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bsmart[ -]?phone\b/i, "smartphone")
    .replace(/\bmobile phone\b/i, "smartphone")
    .slice(0, 160);
}

function cleanCategoryText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAsin(pathname: string): string | null {
  const match = pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|product)\/([a-z0-9]{10})(?:\/|$)/i);
  return match?.[1]?.toUpperCase() ?? null;
}

/**
 * Convert only a real direct Amazon/Flipkart product URL to a stable product
 * URL. Google redirects, generic pages, and URLs without a verifiable product
 * identifier are rejected.
 */
function canonicalProductUrl(raw: string): { merchant: BudgetBuddyMerchant; url: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "amazon.in") {
    const asin = extractAsin(parsed.pathname);
    return asin ? { merchant: "amazon", url: `https://www.amazon.in/dp/${asin}` } : null;
  }

  if (host === "flipkart.com") {
    if (!/\/p\/itm[a-z0-9]+/i.test(parsed.pathname)) return null;
    const pid = parsed.searchParams.get("pid");
    return {
      merchant: "flipkart",
      url:
        `https://www.flipkart.com${parsed.pathname}` +
        (pid ? `?pid=${encodeURIComponent(pid)}` : ""),
    };
  }

  return null;
}

function urlKey(url: string): string {
  return canonicalProductUrl(url)?.url ?? "";
}

function normalizeIdentity(title: string): string {
  return cleanCategoryText(title)
    .replace(/\b(buy|online|india|free delivery|new|latest|official|amazon|flipkart)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeOffers(offers: BudgetBuddyOffer[]): BudgetBuddyOffer[] {
  const seenUrls = new Set<string>();
  const seenIdentities = new Set<string>();

  return offers.filter((offer) => {
    const merchant = resolveMerchant(offer.url, offer.store).slug;
    const normalizedUrl = urlKey(offer.url);
    const identity = normalizeIdentity(offer.title);
    const urlKeyValue = `${merchant}|${normalizedUrl}`;
    const identityKey = `${merchant}|${identity}`;

    if (seenUrls.has(urlKeyValue) || seenIdentities.has(identityKey)) {
      return false;
    }
    seenUrls.add(urlKeyValue);
    seenIdentities.add(identityKey);
    return true;
  });
}

function parseJsonPayload(text: string): unknown | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  for (let start = 0; start < cleaned.length; start += 1) {
    if (cleaned[start] !== "{" && cleaned[start] !== "[") continue;

    const opening = cleaned[start];
    const closing = opening === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let end = start; end < cleaned.length; end += 1) {
      const char = cleaned[end];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === opening) depth += 1;
      if (char === closing) depth -= 1;
      if (depth !== 0) continue;

      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        break;
      }
    }
  }

  return null;
}

function rawProducts(payload: unknown): RawProduct[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is RawProduct => !!item && typeof item === "object");
  }
  if (!payload || typeof payload !== "object") return [];
  const products = (payload as { products?: unknown }).products;
  return Array.isArray(products)
    ? products.filter((item): item is RawProduct => !!item && typeof item === "object")
    : [];
}

function groundedSources(
  metadata: GroundingMetadata | undefined,
  answerText: string,
): GroundedSource[] {
  const chunks = metadata?.groundingChunks ?? [];
  const evidenceByIndex = new Map<number, string[]>();

  for (const support of metadata?.groundingSupports ?? []) {
    const segment = support.segment;
    const text =
      segment?.text ??
      (segment?.startIndex != null && segment.endIndex != null
        ? answerText.slice(segment.startIndex, segment.endIndex)
        : "");
    if (!text) continue;
    for (const index of support.groundingChunkIndices ?? []) {
      const existing = evidenceByIndex.get(index) ?? [];
      existing.push(text);
      evidenceByIndex.set(index, existing);
    }
  }

  return chunks.flatMap((chunk, index) => {
    const uri = chunk.web?.uri;
    const normalized = uri ? canonicalProductUrl(uri) : null;
    if (!normalized) return [];
    return [
      {
        index,
        url: normalized.url,
        title: chunk.web?.title ?? "",
        evidence: (evidenceByIndex.get(index) ?? []).join(" "),
      },
    ];
  });
}

function numbersIn(text: string): number[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [])
    .map((value) => Number(value.replace(/,/g, "")))
    .filter((value) => Number.isFinite(value));
}

function priceIsGrounded(price: number, evidence: string): boolean {
  return numbersIn(evidence).some((value) => Math.abs(value - price) < 0.01);
}

function titleIsGrounded(title: string, source: GroundedSource): boolean {
  const titleStopWords = new Set([
    "and",
    "for",
    "from",
    "with",
    "the",
    "new",
    "best",
    "buy",
    "online",
    "india",
    "price",
  ]);
  const titleWords = cleanCategoryText(title)
    .split(" ")
    .filter((word) => (word.length >= 3 || /\d/.test(word)) && !titleStopWords.has(word));
  if (titleWords.length === 0) return false;

  const sourceText = cleanCategoryText(`${source.title} ${source.evidence}`);
  const matchedWords = titleWords.filter((word) => sourceText.includes(word));
  return matchedWords.length >= Math.max(1, Math.ceil(titleWords.length * 0.6));
}

function numericEvidence(
  value: number | null,
  evidence: string,
  kind: "rating" | "reviews",
): boolean {
  if (value == null) return false;
  const escaped = String(value).replace(".", "\\.");
  if (kind === "rating") {
    return new RegExp(
      `(?:rating|stars?|score)[^\\d]{0,16}${escaped}|${escaped}\\s*(?:/\\s*5|stars?)`,
      "i",
    ).test(evidence);
  }
  return new RegExp(
    `(?:${escaped}[^\\d]{0,8}(?:reviews?|ratings?)|(?:reviews?|ratings?)[^\\d]{0,8}${escaped})`,
    "i",
  ).test(evidence);
}

const ACCESSORY_WORDS =
  /\b(case|cover|charger|cable|screen protector|tempered glass|keyboard cover|sleeve|stand|holder|replacement|spare|adapter|mount|skin|protector|bag)\b/i;
const ACCESSORY_LISTING =
  /^(?:case|cover|charger|cable|screen protector|tempered glass|keyboard cover|sleeve|stand|holder|replacement|spare|adapter|mount|skin|protector|bag)\b|(?:for|compatible with|replacement for)\b.*\b(?:case|cover|charger|cable|screen protector|tempered glass|keyboard cover|sleeve|stand|holder|replacement|spare|adapter|mount|skin|protector|bag)\b|\b(?:laptop|notebook|macbook|phone|smartphone|mobile|tablet|camera|watch)\s+(?:case|cover|bag|sleeve|stand|holder|skin|protector)\b/i;

type ProductProfile = {
  positive: RegExp | null;
  queryWords: string[];
};

function profileForQuery(query: string): ProductProfile {
  const normalized = cleanCategoryText(query);
  const queryWords = normalized.split(" ").filter((word) => word.length >= 3);

  if (/\b(laptop|notebook|macbook|chromebook|ultrabook)\b/.test(normalized)) {
    return {
      positive: /\b(laptop|notebook|macbook|chromebook|ultrabook)\b/i,
      queryWords,
    };
  }
  if (/\b(smartphone|mobile|phone|iphone)\b/.test(normalized)) {
    return {
      positive:
        /\b(smartphone|mobile phone|mobile|phone|iphone|galaxy|pixel|oneplus|redmi|realme|oppo|vivo)\b/i,
      queryWords,
    };
  }
  if (/\b(earbuds?|earphones?|headphones?|airpods?|tws)\b/.test(normalized)) {
    return {
      positive: /\b(earbuds?|earphones?|headphones?|airpods?|tws|airdopes|neckband)\b/i,
      queryWords,
    };
  }
  if (/\b(tv|television|oled|qled)\b/.test(normalized)) {
    return {
      positive: /\b(tv|television|smart tv|led tv|oled|qled|google tv|android tv)\b/i,
      queryWords,
    };
  }

  return { positive: null, queryWords };
}

function isMainProduct(title: string, query: string, source: GroundedSource): boolean {
  const profile = profileForQuery(query);
  const searchable = `${title} ${source.title} ${source.evidence}`;
  const positiveMatch = profile.positive
    ? profile.positive.test(searchable)
    : profile.queryWords.some((word) => searchable.toLowerCase().includes(word));
  if (!positiveMatch) return false;

  // A positive product-family match is required in addition to this
  // accessory check. This prevents "laptop bag" from passing simply because
  // it contains the word "laptop".
  if (
    ACCESSORY_LISTING.test(cleanCategoryText(title)) &&
    !ACCESSORY_WORDS.test(cleanCategoryText(query))
  ) {
    return false;
  }
  return true;
}

function offerFromGroundedProduct(
  product: RawProduct,
  query: string,
  budget: number,
  merchant: BudgetBuddyMerchant,
  sources: GroundedSource[],
): BudgetBuddyOffer | null {
  const title = typeof product.title === "string" ? product.title.trim() : "";
  const rawUrl = typeof product.url === "string" ? product.url.trim() : "";
  const price = parsePrice(product.price);
  if (!title || !rawUrl || price == null || price > budget) return null;

  const normalized = canonicalProductUrl(rawUrl);
  if (!normalized || normalized.merchant !== merchant) return null;

  const source = sources.find((candidate) => candidate.url === normalized.url);
  if (!source || !source.evidence) return null;
  if (!titleIsGrounded(title, source)) return null;
  if (!priceIsGrounded(price, source.evidence)) return null;
  if (!isMainProduct(title, query, source)) return null;

  const { slug, label } = resolveMerchant(normalized.url, null);
  if (slug !== merchant) return null;

  const ratingValue = parseRating(product.rating);
  const reviewsValue = parseReviews(product.reviews);
  const rating = numericEvidence(ratingValue, source.evidence, "rating") ? ratingValue : null;
  const reviews = numericEvidence(reviewsValue, source.evidence, "reviews") ? reviewsValue : null;
  const image =
    typeof product.image === "string" &&
    /^https:\/\//i.test(product.image) &&
    !/google|gstatic|googleusercontent/i.test(product.image)
      ? product.image
      : null;

  const base: CompareOffer = {
    storeRaw: label,
    store: label,
    merchant: slug,
    title: title.slice(0, 220),
    price,
    priceLabel: `₹${Math.round(price).toLocaleString("en-IN")}`,
    shipping: null,
    offer: null,
    image,
    url: normalized.url,
    buyUrl: buildCompareBuyLink(slug, normalized.url),
    rating,
    reviews,
  };

  return {
    ...base,
    reason:
      rating != null
        ? `Verified at ${label}; ${rating}/5 rating shown in the grounded result.`
        : `Verified at ${label} and within your budget.`,
    badge: null,
  };
}

function rank(offer: BudgetBuddyOffer, budget: number): number {
  const rating = offer.rating == null ? 0 : offer.rating / 5;
  const reviews = offer.reviews == null ? 0 : Math.min(Math.log10(offer.reviews + 1) / 6, 1);
  const value = Math.max(0, 1 - (offer.price ?? budget) / budget);
  return rating * 0.55 + reviews * 0.25 + value * 0.2;
}

function selectRecommendations(offers: BudgetBuddyOffer[], budget: number): BudgetBuddyOffer[] {
  const ranked = [...offers].sort((a, b) => rank(b, budget) - rank(a, budget));
  const selected: BudgetBuddyOffer[] = [];
  const addMerchant = (merchant: BudgetBuddyMerchant, count: number) => {
    for (const offer of ranked) {
      if (offer.merchant !== merchant || selected.includes(offer)) continue;
      selected.push(offer);
      if (selected.filter((item) => item.merchant === merchant).length >= count) {
        break;
      }
    }
  };

  // Preserve coverage when valid products exist on both merchants; never
  // manufacture a result for a merchant that returned no grounded product.
  addMerchant("amazon", 2);
  addMerchant("flipkart", 2);
  for (const offer of ranked) {
    if (selected.length >= 5) break;
    if (!selected.includes(offer)) selected.push(offer);
  }
  return selected.slice(0, 5);
}

async function searchMerchantWithGemini(
  apiKey: string,
  query: string,
  budget: number,
  merchant: BudgetBuddyMerchant,
): Promise<GeminiSearchResult> {
  const merchantLabel = merchant === "amazon" ? "Amazon.in" : "Flipkart.com";
  const prompt = `Find real, currently available MAIN ${query} products in India sold on ${merchantLabel}.
Hard budget: INR ${Math.round(budget)}. The listed product price must be greater than zero and no more than the budget.
Use Google Search grounding and only include products supported by a direct result from ${merchantLabel}.
Reject accessories, cases, covers, bags, sleeves, stands, chargers, cables, mounts, replacement parts, and other add-ons when the requested item is the main product.
Return up to 5 genuinely different products. Do not invent any title, price, rating, review count, image, or URL.
For Amazon, return a real URL containing the actual ASIN; the server will canonicalize it to https://www.amazon.in/dp/ASIN. For Flipkart, return the actual direct product page URL containing /p/itm. Never return Google, Gemini, Vertex, redirect, tracking, category, search, or merchant-homepage URLs.
Include an evidence field containing the short grounded text that shows the product title and current listed price. Include rating/reviews only when the grounded result shows them.
Return JSON only, without response-schema instructions: {"products":[{"title":"...","url":"...","price":9999,"rating":4.3,"reviews":1200,"image":"https://...","evidence":"..."}]}`;

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `[budget-buddy] Gemini ${merchant} request failed`,
        response.status,
        errorBody.slice(0, 1000),
      );
      return {
        offers: [],
        error: "Budget Buddy could not complete grounded product search.",
      };
    }

    const body = (await response.json()) as GeminiResponse;
    const candidate = body.candidates?.[0];
    const answerText =
      candidate?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";
    const sources = groundedSources(candidate?.groundingMetadata, answerText);
    if (!answerText || sources.length === 0) {
      console.error(
        `[budget-buddy] Gemini ${merchant} response had no answer or grounded product sources`,
      );
      return {
        offers: [],
        error: "Budget Buddy could not verify grounded product results.",
      };
    }

    const products = rawProducts(parseJsonPayload(answerText));
    const offers = products
      .map((product) => offerFromGroundedProduct(product, query, budget, merchant, sources))
      .filter((offer): offer is BudgetBuddyOffer => offer !== null);

    console.log(
      `[budget-buddy] Gemini ${merchant} grounded candidates=${products.length} valid=${offers.length}`,
    );
    return { offers, error: null };
  } catch (error) {
    console.error(`[budget-buddy] Gemini ${merchant} discovery failed`, error);
    return {
      offers: [],
      error: "Budget Buddy could not complete grounded product search.",
    };
  }
}

async function searchWithGemini(query: string, budget: number): Promise<GeminiSearchResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[budget-buddy] GEMINI_API_KEY is not configured in this deployment");
    return {
      offers: [],
      error: "Budget Buddy is temporarily unavailable because product search is not configured.",
    };
  }

  const results = await Promise.all([
    searchMerchantWithGemini(apiKey, query, budget, "amazon"),
    searchMerchantWithGemini(apiKey, query, budget, "flipkart"),
  ]);
  const offers = dedupeOffers(results.flatMap((result) => result.offers));
  const error =
    offers.length > 0
      ? null
      : (results.find((result) => result.error)?.error ?? "No suitable products found.");
  return { offers, error };
}

export async function findBudgetBuddyProducts(
  rawQuery: string,
  rawBudget: number,
): Promise<BudgetBuddyResult> {
  const query = cleanQuery(rawQuery);
  const budget = Math.round(rawBudget);
  if (query.length < 2) {
    return {
      query,
      budget,
      offers: [],
      source: "gemini",
      error: "Tell us what product you are looking for.",
    };
  }
  if (!Number.isFinite(budget) || budget <= 0 || budget > 10_000_000) {
    return {
      query,
      budget,
      offers: [],
      source: "gemini",
      error: "Enter a valid budget.",
    };
  }

  const search = await searchWithGemini(query, budget);
  const offers = selectRecommendations(search.offers, budget);
  return {
    query,
    budget,
    offers,
    source: "gemini",
    error:
      offers.length > 0
        ? null
        : (search.error ?? `No suitable products found within ₹${budget.toLocaleString("en-IN")}.`),
  };
}
