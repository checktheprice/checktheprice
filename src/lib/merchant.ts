import { buildAmazonAffiliateLink } from "@/lib/affiliate";

export type Merchant = "amazon" | "flipkart";

export type MerchantLabel = "Amazon" | "Flipkart";

/** Detect the merchant from a pasted product URL. Returns null when unsupported. */
export function detectMerchant(rawUrl: string): Merchant | null {
  if (!rawUrl) return null;
  let host: string;
  try {
    host = new URL(rawUrl.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host === "amazon.in" || host.endsWith(".amazon.in")) return "amazon";
  if (host === "flipkart.com" || host.endsWith(".flipkart.com")) return "flipkart";
  return null;
}

export function merchantLabel(m: Merchant): MerchantLabel {
  return m === "flipkart" ? "Flipkart" : "Amazon";
}

/**
 * Resolve the outbound "Grab Deal" link for a product.
 * Amazon: always the Associates link (unchanged behaviour).
 * Every other merchant (Flipkart, Croma, Reliance Digital, Vijay Sales,
 * Tata CLiQ, Myntra, AJIO, …): the original merchant product URL, monetized
 * automatically by the globally installed Cuelinks script.
 */
export function buildMerchantAffiliateLink(
  merchant: Merchant,
  productUrl: string,
  _cuelinksUrl?: string | null,
): string {
  if (merchant === "amazon") return buildAmazonAffiliateLink(productUrl);
  return productUrl.trim();
}
