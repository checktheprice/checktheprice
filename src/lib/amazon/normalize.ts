import { buildAmazonAffiliateLink } from "@/lib/affiliate";

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

// PA API payloads are large and mostly optional — stay defensive, never throw.
export type PaapiItem = {
  ASIN: string;
  ItemInfo?: {
    Title?: { DisplayValue?: string };
    ByLineInfo?: { Brand?: { DisplayValue?: string }; Manufacturer?: { DisplayValue?: string } };
  };
  Images?: { Primary?: { Large?: { URL?: string } } };
  Offers?: {
    Listings?: Array<{
      Price?: { Amount?: number; Currency?: string; Savings?: { Amount?: number; Percentage?: number } };
      SavingBasis?: { Amount?: number };
      Availability?: { Message?: string };
    }>;
  };
  CustomerReviews?: { Count?: number; StarRating?: { Value?: number } };
};

export function normalizeItem(item: PaapiItem): NormalizedProduct {
  const listing = item.Offers?.Listings?.[0];
  const price = listing?.Price?.Amount ?? null;
  const listPrice = listing?.SavingBasis?.Amount ?? null;

  let savings = listing?.Price?.Savings?.Amount ?? null;
  let discount = listing?.Price?.Savings?.Percentage ?? null;
  if (savings == null && price != null && listPrice != null && listPrice > price) {
    savings = Math.round((listPrice - price) * 100) / 100;
  }
  if (discount == null && price != null && listPrice != null && listPrice > 0) {
    discount = Math.round(((listPrice - price) / listPrice) * 100);
  }

  const host = (process.env.AMAZON_HOST ?? "webservices.amazon.in").replace(/^webservices\./, "");
  const standardLink = `https://www.${host}/dp/${item.ASIN}`;

  return {
    asin: item.ASIN,
    title: item.ItemInfo?.Title?.DisplayValue ?? null,
    brand:
      item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue ??
      item.ItemInfo?.ByLineInfo?.Manufacturer?.DisplayValue ??
      null,
    image: item.Images?.Primary?.Large?.URL ?? null,
    currentPrice: price,
    currency: listing?.Price?.Currency ?? null,
    listPrice,
    savingsAmount: savings,
    discountPercent: discount,
    availability: listing?.Availability?.Message ?? null,
    rating: item.CustomerReviews?.StarRating?.Value ?? null,
    reviewCount: item.CustomerReviews?.Count ?? null,
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
