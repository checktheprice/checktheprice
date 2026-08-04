import amazonLogo from "@/assets/marketplaces/amazon.svg";
import flipkartLogo from "@/assets/marketplaces/flipkart.svg";

export type Marketplace = "amazon" | "flipkart" | "other";

type MarketplaceConfig = {
  name: string;
  logo: string;
};

/**
 * Central marketplace configuration.
 * Add a new entry here to support another marketplace — nothing else needs to change.
 */
export const MARKETPLACES: Record<Exclude<Marketplace, "other">, MarketplaceConfig> = {
  amazon: {
    name: "Amazon",
    logo: amazonLogo,
  },
  flipkart: {
    name: "Flipkart",
    logo: flipkartLogo,
  },
};

/**
 * Detect the marketplace from a product URL or source field.
 *
 * Recognises:
 *   - amazon.in, amzn.in  -> "amazon"
 *   - flipkart.com        -> "flipkart"
 *   - anything else       -> "other"
 *
 * Also accepts the Deal.source values ("Amazon" / "Flipkart") as a fallback
 * when no URL is available.
 */
export function getMarketplace(
  urlOrSource?: string | null,
): Marketplace {
  if (!urlOrSource) return "other";
  const lower = urlOrSource.toLowerCase().trim();

  // URL-based detection
  try {
    const host = new URL(lower).hostname.toLowerCase();
    if (host === "amazon.in" || host.endsWith(".amazon.in")) return "amazon";
    if (host === "amzn.in" || host.endsWith(".amzn.in")) return "amazon";
    if (host === "flipkart.com" || host.endsWith(".flipkart.com"))
      return "flipkart";
  } catch {
    // Not a URL — fall through to source-name detection
  }

  // Source-name detection (Deal.source values: "Amazon" / "Flipkart")
  if (lower === "amazon" || lower.includes("amazon")) return "amazon";
  if (lower === "flipkart" || lower.includes("flipkart")) return "flipkart";

  return "other";
}
