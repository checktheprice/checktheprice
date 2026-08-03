/**
 * Product search service (server only).
 * Turns a user query (product name OR Amazon/Flipkart product URL) into a
 * sorted, affiliate-aware list of comparison offers.
 *
 * Buy links NEVER point at a Google Shopping redirect: every offer must carry a
 * real merchant product URL, resolved through the Google Immersive Product API
 * when the search result only exposes a Google link.
 */
import { buildCompareBuyLink, resolveMerchant } from "./merchants";
import type { CompareOffer, CompareResult } from "./types";
import {
  collectStoreEntries,
  serpApiGoogleShopping,
  serpApiImmersiveProduct,
  type SerpShoppingResult,
} from "./serpapi.server";
import {
  detectMerchantUrl,
  scrapeProduct,
} from "@/lib/scrape/firecrawl.server";

/** Max parallel merchant-link resolutions per search. */
const MAX_LINK_RESOLUTIONS = 10;

function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

/** True for Google-owned URLs (search, shopping redirects, /url?q= wrappers). */
export function isGoogleUrl(raw: string | null | undefined): boolean {
  if (!raw) return true;
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
    return (
      host === "google.com" ||
      host.startsWith("google.") ||
      host.endsWith(".google.com") ||
      /(^|\.)google\.[a-z.]+$/.test(host) ||
      host.endsWith("gstatic.com") ||
      host.endsWith("googleusercontent.com")
    );
  } catch {
    return true;
  }
}

/** Unwrap https://www.google.com/url?q=<merchant url> style redirects. */
export function unwrapGoogleRedirect(raw: string): string {
  try {
    const u = new URL(raw);
    for (const key of ["q", "url", "adurl", "u"]) {
      const v = u.searchParams.get(key);
      if (v && /^https?:\/\//i.test(v) && !isGoogleUrl(v)) return v;
    }
  } catch {
    /* ignore */
  }
  return raw;
}

/** First usable non-Google merchant URL directly present on the result. */
function directMerchantUrl(r: SerpShoppingResult): string | null {
  const candidates = [r.direct_link, r.link, r.product_link]
    .map((c) => (c ?? "").trim())
    .filter(Boolean)
    .map(unwrapGoogleRedirect);
  return candidates.find((c) => !isGoogleUrl(c)) ?? null;
}

function immersiveToken(r: SerpShoppingResult): string | null {
  if (r.immersive_product_page_token) return r.immersive_product_page_token;
  const api = r.serpapi_immersive_product_api;
  if (!api) return null;
  try {
    return new URL(api).searchParams.get("page_token");
  } catch {
    return null;
  }
}

/**
 * Resolve the real merchant product URL for a Google Shopping result.
 * Returns null when no non-Google URL can be found.
 */
async function resolveMerchantUrl(
  r: SerpShoppingResult,
): Promise<string | null> {
  const direct = directMerchantUrl(r);
  if (direct) return direct;

  const token = immersiveToken(r);
  if (!token) return null;

  const body = await serpApiImmersiveProduct(token);
  if (body.error) return null;

  const entries = collectStoreEntries(body);
  const wantedStore = (r.source ?? "").toLowerCase().trim();

  const urls = entries.map((s) => {
    const link = (s.direct_link || s.link || s.base_link || "").trim();
    return {
      name: (s.name || s.merchant || "").toLowerCase(),
      url: link ? unwrapGoogleRedirect(link) : "",
    };
  });

  // Prefer the entry that matches the store reported by the search result.
  const matched = urls.find(
    (s) =>
      s.url &&
      !isGoogleUrl(s.url) &&
      wantedStore.length > 0 &&
      s.name.length > 0 &&
      (s.name.includes(wantedStore) || wantedStore.includes(s.name)),
  );
  if (matched) return matched.url;

  const any = urls.find((s) => s.url && !isGoogleUrl(s.url));
  return any?.url ?? null;
}

function titleFromSlug(u: URL): string | null {
  const parts = u.pathname.split("/").filter(Boolean);
  const slug = parts.find((p) => p.includes("-") && p.length > 8);
  if (!slug) return null;
  const words = slug
    .replace(/\.html?$/i, "")
    .split("-")
    .filter((w) => w.length > 1 && !/^[A-Z0-9]{10}$/i.test(w));
  const text = words.join(" ").trim();
  return text.length > 3 ? text.slice(0, 120) : null;
}

/**
 * Best-effort product title extraction from a merchant product URL.
 *
 * For Amazon.in and Flipkart.com URLs the shared Firecrawl scraper (the same
 * module the Admin import workflow uses) is tried first — it handles CAPTCHA
 * pages and proxy fallback that a raw fetch cannot. If Firecrawl is not
 * configured or the scrape fails, the raw-fetch fallback is used so existing
 * behaviour is preserved for non-Firecrawl deployments.
 */
export async function resolveTitleFromUrl(
  rawUrl: string,
): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  // 1. Try the shared Firecrawl scraper for Amazon/Flipkart product URLs.
  if (detectMerchantUrl(rawUrl) && process.env.FIRECRAWL_API_KEY) {
    try {
      const product = await scrapeProduct(rawUrl);
      if (product.title && product.title.length > 3) {
        return product.title.slice(0, 160);
      }
    } catch (e) {
      console.error("[compare] firecrawl title extraction failed", e);
    }
  }

  // 2. Fallback: raw fetch + regex parse (original behaviour).
  try {
    const res = await fetch(u.toString(), {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "accept-language": "en-IN,en;q=0.9",
      },
    });
    if (res.ok) {
      const html = await res.text();
      const og =
        html.match(
          /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        ) ??
        html.match(
          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
        );
      const idTitle = html.match(
        /id=["']productTitle["'][^>]*>([\s\S]{3,300}?)</i,
      );
      const docTitle = html.match(/<title[^>]*>([\s\S]{3,300}?)<\/title>/i);
      const raw = og?.[1] ?? idTitle?.[1] ?? docTitle?.[1];
      const cleaned = raw
        ?.replace(/&amp;/g, "&")
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .replace(
          /\s*[:|-]\s*(Buy Online.*|Amazon\.in.*|Flipkart\.com.*|Price in India.*)$/i,
          "",
        )
        .trim();
      if (
        cleaned &&
        cleaned.length > 3 &&
        !/robot check|captcha/i.test(cleaned)
      ) {
        return cleaned.slice(0, 160);
      }
    }
  } catch (e) {
    console.error("[compare] title fetch failed", e);
  }

  return titleFromSlug(u);
}

function toOffer(
  r: SerpShoppingResult,
  merchantUrl: string,
): CompareOffer | null {
  const url = merchantUrl.trim();
  const title = (r.title ?? "").trim();
  if (!url || !title || isGoogleUrl(url)) return null;

  const { slug, label } = resolveMerchant(url, r.source);
  const price =
    typeof r.extracted_price === "number" && r.extracted_price > 0
      ? r.extracted_price
      : null;

  return {
    storeRaw: r.source ?? label,
    store: label,
    merchant: slug,
    title,
    price,
    priceLabel: r.price ?? null,
    shipping: r.delivery ?? r.shipping ?? null,
    offer: r.tag ?? r.badge ?? null,
    image: r.thumbnail ?? null,
    url,
    // Amazon -> Associates link, Flipkart -> Cuelinks when configured,
    // everything else -> the direct merchant product URL.
    buyUrl: buildCompareBuyLink(slug, url),
    rating: typeof r.rating === "number" ? r.rating : null,
    reviews: typeof r.reviews === "number" ? r.reviews : null,
  };
}

export async function comparePrices(rawQuery: string): Promise<CompareResult> {
  const input = (rawQuery ?? "").trim();
  const empty = (error: string | null, query = input): CompareResult => ({
    query,
    resolvedFromUrl: false,
    offers: [],
    lowestPrice: null,
    highestPrice: null,
    savings: null,
    error,
  });

  if (input.length < 2) return empty("Enter a product name or a product URL.");

  let query = input;
  let resolvedFromUrl = false;
  if (isUrl(input)) {
    const title = await resolveTitleFromUrl(input);
    if (!title) {
      return empty(
        "Could not read the product name from that link. Try typing the product name instead.",
      );
    }
    query = title;
    resolvedFromUrl = true;
  }

  const res = await serpApiGoogleShopping(query);
  if (res.error) return { ...empty(res.error, query), resolvedFromUrl };

  const raw = [
    ...(res.shopping_results ?? []),
    ...(res.inline_shopping_results ?? []),
    ...(res.immersive_products ?? []),
  ].filter((r) => (r.title ?? "").trim().length > 0);

  // Results that already expose a merchant URL need no extra API call.
  const withDirect = raw.filter((r) => directMerchantUrl(r) !== null);
  const needsLookup = raw
    .filter((r) => directMerchantUrl(r) === null && immersiveToken(r) !== null)
    .slice(0, MAX_LINK_RESOLUTIONS);

  const resolved = await Promise.all([
    ...withDirect.map((r) => ({ r, url: directMerchantUrl(r) })),
    ...needsLookup.map(async (r) => ({ r, url: await resolveMerchantUrl(r) })),
  ]);

  const seen = new Set<string>();
  const offers = resolved
    .map(({ r, url }) => (url ? toOffer(r, url) : null))
    .filter((o): o is CompareOffer => o !== null)
    .filter((o) => {
      const key = `${o.merchant}|${o.price ?? "na"}|${o.title.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      if (a.price == null) return 1;
      if (b.price == null) return -1;
      return a.price - b.price;
    });

  const priced = offers.filter((o) => o.price != null).map((o) => o.price!);
  const lowestPrice = priced.length ? Math.min(...priced) : null;
  const highestPrice = priced.length ? Math.max(...priced) : null;
  const savings =
    lowestPrice != null && highestPrice != null && highestPrice > lowestPrice
      ? Math.round(highestPrice - lowestPrice)
      : null;

  return {
    query,
    resolvedFromUrl,
    offers,
    lowestPrice,
    highestPrice,
    savings,
    error: offers.length ? null : "No offers found for this product.",
  };
}
