/**
 * Firecrawl fallback provider for the price comparison feature (server only).
 *
 * Used ONLY when SerpApi fails transiently (quota exceeded, rate limit,
 * timeout, service unavailable) — SerpApi remains the primary provider.
 *
 * It discovers Amazon.in / Flipkart product pages for the query via Firecrawl
 * web search, then prices each one through the SAME shared scraper the Admin
 * import workflow uses (scrapeProduct), so no extraction logic is duplicated.
 * The offers it returns feed the same matcher and result assembly as the
 * SerpApi path, keeping the CompareResult contract identical.
 */
import Firecrawl from "@mendable/firecrawl-js";
import { canonicalLink, scrapeProduct, type ScrapedProduct } from "@/lib/scrape/firecrawl.server";
import { buildCompareBuyLink, resolveMerchant } from "./merchants";
import type { CompareOffer } from "./types";

/** Max product pages priced per fallback search (each is a full scrape). */
const MAX_FALLBACK_SCRAPES = 3;

/** Search results considered before capping to MAX_FALLBACK_SCRAPES. */
const SEARCH_LIMIT = 10;

export function hasFirecrawlKey(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

function formatInr(price: number): string {
  return `₹${price.toLocaleString("en-IN")}`;
}

function toOffer(p: ScrapedProduct): CompareOffer {
  const { slug, label } = resolveMerchant(p.standardLink, p.merchant);
  return {
    storeRaw: p.merchant,
    store: label,
    merchant: slug,
    title: p.title,
    price: p.price,
    priceLabel: formatInr(p.price),
    shipping: null,
    offer: null,
    image: p.image || null,
    url: p.standardLink,
    buyUrl: buildCompareBuyLink(slug, p.standardLink),
    rating: null,
    reviews: null,
  };
}

/**
 * Search supported merchants for the query and return priced offers.
 * `excludeUrls` (e.g. the pasted product) are skipped to save scrapes.
 * Failures on individual product pages are logged and skipped.
 */
export async function firecrawlFallbackOffers(
  query: string,
  excludeUrls: string[] = [],
): Promise<CompareOffer[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is not configured on the server.");
  }

  const firecrawl = new Firecrawl({ apiKey });
  const res = await firecrawl.search(query, {
    limit: SEARCH_LIMIT,
    includeDomains: ["amazon.in", "flipkart.com"],
    location: "India",
    integration: "prometheus",
  });

  const excluded = new Set(
    excludeUrls.map((u) => canonicalLink(u)?.standardLink).filter((u): u is string => Boolean(u)),
  );

  // Keep only real product pages, canonicalized and deduped.
  const seen = new Set<string>();
  const targets: string[] = [];
  for (const hit of res.web ?? []) {
    const url = "url" in hit && typeof hit.url === "string" ? hit.url : null;
    if (!url) continue;
    const meta = canonicalLink(url);
    if (!meta) continue;
    if (excluded.has(meta.standardLink) || seen.has(meta.standardLink)) continue;
    seen.add(meta.standardLink);
    targets.push(meta.standardLink);
    if (targets.length >= MAX_FALLBACK_SCRAPES) break;
  }

  console.log(
    `[compare] firecrawl fallback: ${res.web?.length ?? 0} search hits, pricing ${targets.length} product page(s)`,
  );

  const settled = await Promise.allSettled(targets.map((u) => scrapeProduct(u)));
  const offers: CompareOffer[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      offers.push(toOffer(r.value));
    } else {
      console.error(`[compare] firecrawl fallback: scrape failed for ${targets[i]}`, r.reason);
    }
  });
  return offers;
}
