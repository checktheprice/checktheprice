import { buildMerchantAffiliateLink } from "@/lib/merchant";
import type {
  BudgetDiscoveryResult,
  BudgetRecommendation,
} from "./types";

type UnknownRecord = Record<string, unknown>;

type GroundingChunk = {
  uri: string;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecord(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isHttpsProductUrl(raw: string): {
  canonical: string;
  store: BudgetRecommendation["store"];
  url: URL;
} | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;

    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const amazon = host === "amazon.in" || host.endsWith(".amazon.in");
    const flipkart = host === "flipkart.com" || host.endsWith(".flipkart.com");
    if (!amazon && !flipkart) return null;

    const path = url.pathname;
    const isAmazonProduct =
      amazon && /\/(?:dp|gp\/product)\/[A-Z0-9]{10}(?:\/|$)/i.test(path);
    const isFlipkartProduct =
      flipkart && /\/p\/[a-z0-9]{8,}(?:\/|$)/i.test(path);
    if (!isAmazonProduct && !isFlipkartProduct) return null;

    url.hash = "";
    return {
      canonical: `${url.origin.toLowerCase()}${url.pathname.replace(/\/$/, "")}`.toLowerCase(),
      store: amazon ? "Amazon" : "Flipkart",
      url,
    };
  } catch {
    return null;
  }
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function hasProductTitleEvidence(title: string, evidence: string): boolean {
  const titleTokens = [...new Set(tokenize(title))];
  if (titleTokens.length === 0) return false;
  const evidenceTokens = new Set(tokenize(evidence));
  const overlap = titleTokens.filter((token) => evidenceTokens.has(token)).length;
  const requiredTokens = Math.min(2, titleTokens.length);
  return overlap >= requiredTokens && overlap / titleTokens.length >= 0.5;
}

function normalizeMoney(value: string): number | null {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function hasPriceEvidence(price: number, evidence: string): boolean {
  const amountPattern = "([\\d,]+(?:\\.\\d{1,2})?)";
  const currencyAmounts = new RegExp(
    `(?:₹|\\bINR\\b|\\bRs\\.?\\s*)\\s*${amountPattern}(?![\\d,])`,
    "gi",
  );
  const jsonAmounts = new RegExp(
    `["']?price["']?\\s*:\\s*["']?₹?\\s*${amountPattern}(?![\\d,])`,
    "gi",
  );
  for (const match of `${evidence}\n${evidence.match(/.{0,30}price.{0,60}/i)?.[0] ?? ""}`.matchAll(currencyAmounts)) {
    const found = normalizeMoney(match[1] ?? "");
    if (found != null && Math.abs(found - price) < 0.01) return true;
  }
  for (const match of evidence.matchAll(jsonAmounts)) {
    const found = normalizeMoney(match[1] ?? "");
    if (found != null && Math.abs(found - price) < 0.01) return true;
  }
  return false;
}

function isAccessory(title: string): boolean {
  return /\b(?:case|cover|charger|charging cable|adapter|screen protector|tempered glass|skin|sleeve|bag|stand|mount|remote control|replacement battery|earbud tips|ear cushions|protective film|stylus|replacement part|spare part)\b/i.test(
    title,
  );
}

function matchesProductQuery(title: string, query: string): boolean {
  const normalizedTitle = ` ${tokenize(title).join(" ")} `;
  const normalizedQuery = query.toLowerCase();
  const categories: string[][] = [
    ["laptop", "notebook"],
    ["smartphone", "smart phone", "mobile phone", "mobile", "cellphone", "phone"],
    ["earbud", "earbuds", "earphone", "earphones", "headphone", "headphones", "tws"],
    ["tv", "television"],
  ];
  const category = categories.find((terms) =>
    terms.some((term) => normalizedQuery.includes(term)),
  );
  if (category) {
    if (category.includes("tv")) return /\b(?:tv|television)s?\b/i.test(title);
    if (category.includes("smartphone")) {
      return /\b(?:smart\s*phone|mobile|phone|iphone|pixel|galaxy|redmi|poco|realme|oneplus|motorola|oppo|vivo|nothing\s*phone)\b/i.test(title);
    }
    if (category.includes("earbud")) {
      return /\b(?:earbuds?|earphones?|headphones?|tws|airdopes|airpods|buds)\b/i.test(title);
    }
    return category.some((term) => {
      const termTokens = tokenize(term);
      return termTokens.length > 0 && termTokens.every((token) => normalizedTitle.includes(` ${token} `));
    });
  }

  const ignored = new Set(["for", "with", "and", "the", "buy", "best", "under", "budget"]);
  const queryTokens = [...new Set(tokenize(query).filter((token) => !ignored.has(token)))];
  if (queryTokens.length === 0) return false;
  const titleTokens = new Set(tokenize(title));
  const overlap = queryTokens.filter((token) => titleTokens.has(token)).length;
  return overlap >= Math.min(2, queryTokens.length) && overlap / queryTokens.length >= 0.5;
}

function parseModelProducts(text: string): unknown[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) return [];

  try {
    const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
    const products = getRecord(parsed)?.products;
    return Array.isArray(products) ? products : [];
  } catch {
    return [];
  }
}

function readGroundingChunks(metadata: UnknownRecord): Array<GroundingChunk | null> {
  const chunks = metadata.groundingChunks;
  if (!Array.isArray(chunks)) return [];

  return chunks.flatMap((rawChunk) => {
    const web = getRecord(getRecord(rawChunk)?.web);
    const uri = getString(web?.uri);
    return [{ uri }];
  });
}

function readGroundingEvidence(metadata: UnknownRecord, chunks: GroundingChunk[]): Map<number, string> {
  const supports = metadata.groundingSupports;
  const evidence = new Map<number, string>();
  if (!Array.isArray(supports)) return evidence;

  for (const rawSupport of supports) {
    const support = getRecord(rawSupport);
    const segment = getRecord(support?.segment);
    const text = getString(segment?.text);
    const indices = support?.groundingChunkIndices;
    if (!text || !Array.isArray(indices)) continue;

    for (const index of indices) {
      if (typeof index !== "number" || !chunks[index]?.uri) continue;
      evidence.set(index, `${evidence.get(index) ?? ""} ${text}`);
    }
  }
  return evidence;
}

function emptyResult(error: string): BudgetDiscoveryResult {
  return { products: [], error };
}

export function validateGroundedProducts(
  payload: unknown,
  query: string,
  budget: number,
): BudgetRecommendation[] {
  const response = getRecord(payload);
  const candidates = response?.candidates;
  const firstCandidate = Array.isArray(candidates) ? getRecord(candidates[0]) : null;
  const metadata = getRecord(firstCandidate?.groundingMetadata);
  const chunks = metadata ? readGroundingChunks(metadata) : [];
  if (!metadata || chunks.length === 0) return [];

  const evidenceByChunk = readGroundingEvidence(metadata, chunks);
  const parts = getRecord(firstCandidate?.content)?.parts;
  if (!Array.isArray(parts)) return [];
  const text = parts
    .map((part) => getString(getRecord(part)?.text) ?? "")
    .join("\n");

  const seen = new Set<string>();
  const verified: BudgetRecommendation[] = [];
  for (const rawProduct of parseModelProducts(text)) {
    const product = getRecord(rawProduct);
    const title = getString(product?.title)?.trim();
    const rawUrl = getString(product?.url)?.trim();
    const price = product?.price;
    if (
      !title ||
      title.length < 4 ||
      title.length > 240 ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price <= 0 ||
      price > budget ||
      !rawUrl ||
      isAccessory(title) ||
      !matchesProductQuery(title, query)
    ) {
      continue;
    }

    const productUrl = isHttpsProductUrl(rawUrl);
    if (!productUrl) continue;
    const chunkIndex = chunks.findIndex((chunk) => {
      if (!chunk) return false;
      const groundedUrl = isHttpsProductUrl(chunk.uri);
      return groundedUrl?.canonical === productUrl.canonical;
    });
    if (chunkIndex < 0) continue;

    const evidence = evidenceByChunk.get(chunkIndex) ?? "";
    if (!hasProductTitleEvidence(title, evidence) || !hasPriceEvidence(price, evidence)) {
      continue;
    }

    if (seen.has(productUrl.canonical)) continue;
    seen.add(productUrl.canonical);
    verified.push({
      title,
      price,
      store: productUrl.store,
      url: productUrl.url.toString(),
      buyUrl: buildMerchantAffiliateLink(
        productUrl.store === "Amazon" ? "amazon" : "flipkart",
        productUrl.url.toString(),
      ),
    });
    if (verified.length === 5) break;
  }

  return verified;
}

export async function discoverBudgetProducts(args: {
  query: string;
  budget: number;
  apiKey: string | undefined;
}): Promise<BudgetDiscoveryResult> {
  const query = args.query.trim();
  if (query.length < 2 || !Number.isFinite(args.budget) || args.budget <= 0) {
    return emptyResult("Enter a product name and a valid budget to continue.");
  }
  if (!args.apiKey) {
    return emptyResult("Product discovery is not configured in this preview environment.");
  }

  const prompt = `Find current, purchasable products in India for this request: ${JSON.stringify(query)}. The maximum budget is ₹${Math.floor(args.budget).toLocaleString("en-IN")} per product. Use Google Search now. Prioritize direct product-detail pages on Amazon.in and Flipkart.com. Return only the actual requested product type, never accessories, bundles of accessories, cases, covers, chargers, or unrelated items. Include only products whose current Indian rupee price and exact direct merchant product URL are supported by the search results. Never infer or invent a product, price, URL, rating, review count, ASIN, stock status, or specification. Return a JSON object only in this shape: {"products":[{"title":"exact listed product title","price":12345,"url":"https://www.amazon.in/dp/XXXXXXXXXX"}]}. The price must be a numeric INR amount. Return up to 10 distinct candidates, ordered by suitability. If evidence is missing, omit the candidate; if no candidates are verified, return {"products":[]}.`;

  let response: Response;
  try {
    response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": args.apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        }),
      },
    );
  } catch {
    return emptyResult("Could not reach product search right now. Please try again shortly.");
  }

  if (!response.ok) {
    console.error("[budget-buddy] Gemini request failed", response.status);
    if (response.status === 401 || response.status === 403) {
      return emptyResult("Gemini search access is unavailable for this deployment.");
    }
    if (response.status === 429) {
      return emptyResult("Gemini search is busy right now. Please try again later.");
    }
    if (response.status >= 500) {
      return emptyResult("Product search is temporarily unavailable. Please try again later.");
    }
    return emptyResult("Product search could not process this request.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return emptyResult("Product search returned an unreadable response. Please try again.");
  }

  const products = validateGroundedProducts(payload, query, args.budget);
  if (products.length < 3) {
    return emptyResult(
      "Fewer than three products could be verified with matching prices on Amazon.in or Flipkart within your budget. Try a more specific search.",
    );
  }

  return { products, error: null };
}