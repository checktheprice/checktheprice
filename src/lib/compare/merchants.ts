import { buildAmazonAffiliateLink } from "@/lib/affiliate";

/**
 * Merchant registry for the price comparison feature.
 * Add a new entry here to support another store — nothing else needs to change.
 */
export type MerchantSlug =
  | "amazon"
  | "flipkart"
  | "croma"
  | "reliancedigital"
  | "tatacliq"
  | "vijaysales"
  | "jiomart"
  | "other";

type MerchantDef = {
  slug: MerchantSlug;
  label: string;
  /** Substrings matched against the hostname or provider store name. */
  match: string[];
};

export const MERCHANTS: MerchantDef[] = [
  { slug: "amazon", label: "Amazon", match: ["amazon"] },
  { slug: "flipkart", label: "Flipkart", match: ["flipkart"] },
  { slug: "croma", label: "Croma", match: ["croma"] },
  {
    slug: "reliancedigital",
    label: "Reliance Digital",
    match: ["reliancedigital", "reliance digital"],
  },
  { slug: "tatacliq", label: "Tata CLiQ", match: ["tatacliq", "tata cliq"] },
  {
    slug: "vijaysales",
    label: "Vijay Sales",
    match: ["vijaysales", "vijay sales"],
  },
  { slug: "jiomart", label: "JioMart", match: ["jiomart", "jio mart"] },
];

/** Resolve a merchant from a product URL and/or the provider's store name. */
export function resolveMerchant(
  url: string | null | undefined,
  storeName: string | null | undefined,
): { slug: MerchantSlug; label: string } {
  let host = "";
  try {
    host = url ? new URL(url).hostname.toLowerCase() : "";
  } catch {
    host = "";
  }
  const name = (storeName ?? "").toLowerCase();
  const hay = `${host} ${name}`;
  const hit = MERCHANTS.find((m) => m.match.some((t) => hay.includes(t)));
  if (hit) return { slug: hit.slug, label: hit.label };
  const fallback =
    (storeName ?? "").trim() ||
    host.replace(/^www\./, "").split(".")[0] ||
    "Store";
  return { slug: "other", label: fallback };
}

/**
 * Build the outbound buy link for a comparison offer.
 * Amazon reuses the site's existing Associates link generator.
 * Flipkart uses the Cuelinks URL when supplied, otherwise the raw product URL.
 * All other merchants use their original URL for now.
 */
export function buildCompareBuyLink(
  slug: MerchantSlug,
  productUrl: string,
  flipkartAffiliateUrl?: string | null,
): string {
  const url = (productUrl ?? "").trim();
  if (!url) return url;
  if (slug === "amazon") return buildAmazonAffiliateLink(url);
  if (slug === "flipkart") {
    const cue = (flipkartAffiliateUrl ?? "").trim();
    return cue || url;
  }
  return url;
}