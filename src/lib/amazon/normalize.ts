import { buildAmazonAffiliateLink } from "@/lib/affiliate";
import { marketplace } from "./client";

export type NormalizedProduct = {
  asin: string;
  title: string | null;
  brand: string | null;
  image: string | null;
  currentPrice: number | null;
  currency: string | null;
  listPrice: number | null;
  savingsAmount: number | null;
  discountPercent: number | null;
  availability: string | null;
  rating: number | null;
  reviewCount: number | null;
  standardLink: string;
  affiliateLink: string;
  fetchedAt: string;
};

// Creators API payloads are lowerCamelCase and mostly optional - stay defensive, never throw.
type Money = { amount?: number; currency?: string; displayAmount?: string };

export type CreatorsItem = {
  asin?: string;
  ASIN?: string;
  parentASIN?: string;
  detailPageURL?: string;
  itemInfo?: {
    title?: { displayValue?: string };
    byLineInfo?: { brand?: { displayValue?: string }; manufacturer?: { displayValue?: string } };
  };
  images?: { primary?: { large?: { url?: string }; medium?: { url?: string }; small?: { url?: string } } };
  offersV2?: {
    listings?: Array<{
      price?: {
        money?: Money;
        savingBasis?: { money?: Money };
        savings?: { money?: Money; percentage?: number };
      };
      availability?: { message?: string; type?: string };
      isBuyBoxWinner?: boolean;
    }>;
  };
  customerReviews?: { count?: number; starRating?: { value?: number } };
};

/** Alias kept so existing imports (PaapiItem) keep compiling. */
export type PaapiItem = CreatorsItem;

export function normalizeItem(item: CreatorsItem): NormalizedProduct {
  const asin = (item.asin ?? item.ASIN ?? "").toUpperCase();
  const listings = item.offersV2?.listings ?? [];
  // Prefer the buy-box listing; that is the price the customer actually sees.
  const listing = listings.find((l) => l.isBuyBoxWinner) ?? listings[0];

  const price = listing?.price?.money?.amount ?? null;
  const listPrice = listing?.price?.savingBasis?.money?.amount ?? null;

  let savings = listing?.price?.savings?.money?.amount ?? null;
  let discount = listing?.price?.savings?.percentage ?? null;
  if (savings == null && price != null && listPrice != null && listPrice > price) {
    savings = Math.round((listPrice - price) * 100) / 100;
  }
  if (discount == null && price != null && listPrice != null && listPrice > 0) {
    discount = Math.round(((listPrice - price) / listPrice) * 100);
  }

  const host = marketplace().replace(/^www\./, "");
  const standardLink = item.detailPageURL
    ? item.detailPageURL.split("?")[0]
    : `https://www.${host}/dp/${asin}`;

  return {
    asin,
    title: item.itemInfo?.title?.displayValue ?? null,
    brand:
      item.itemInfo?.byLineInfo?.brand?.displayValue ??
      item.itemInfo?.byLineInfo?.manufacturer?.displayValue ??
      null,
    image:
      item.images?.primary?.large?.url ??
      item.images?.primary?.medium?.url ??
      item.images?.primary?.small?.url ??
      null,
    currentPrice: price,
    currency: listing?.price?.money?.currency ?? null,
    listPrice,
    savingsAmount: savings,
    discountPercent: discount,
    availability: listing?.availability?.message ?? listing?.availability?.type ?? null,
    rating: item.customerReviews?.starRating?.value ?? null,
    reviewCount: item.customerReviews?.count ?? null,
    standardLink,
    // Reuses the site's single source of truth for the affiliate tag.
    affiliateLink: buildAmazonAffiliateLink(standardLink),
    fetchedAt: new Date().toISOString(),
  };
}

export function extractAsin(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl);
    const m =
      u.pathname.match(/\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i) ??
      u.pathname.match(/\/gp\/product\/([A-Z0-9]{10})(?:[/?]|$)/i) ??
      u.pathname.match(/\/gp\/aw\/d\/([A-Z0-9]{10})(?:[/?]|$)/i) ??
      u.pathname.match(/\/product\/([A-Z0-9]{10})(?:[/?]|$)/i);
    return m ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}
