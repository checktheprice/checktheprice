/**
 * Product search service (server only).
 * Turns a user query (product name OR Amazon/Flipkart product URL) into a
 * sorted, affiliate-aware list of comparison offers.
 */
import { buildCompareBuyLink, resolveMerchant } from "./merchants";
import type { CompareOffer, CompareResult } from "./types";
import {
  serpApiGoogleShopping,
  type SerpShoppingResult,
} from "./serpapi.server";

function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
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

/** Best-effort product title extraction from a merchant product URL. */
export async function resolveTitleFromUrl(rawUrl: string): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    return null;
  }

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
      if (cleaned && cleaned.length > 3 && !/robot check|captcha/i.test(cleaned)) {
        return cleaned.slice(0, 160);
      }
    }
  } catch (e) {
    console.error("[compare] title fetch failed", e);
  }

  return titleFromSlug(u);
}

function toOffer(r: SerpShoppingResult): CompareOffer | null {
  const url = (r.product_link || r.link || "").trim();
  const title = (r.title ?? "").trim();
  if (!url || !title) return null;

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
  ];
  
console.log("SerpApi first result:", JSON.stringify(raw[0], null, 2));
  const seen = new Set<string>();
  const offers = raw
    .map(toOffer)
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
