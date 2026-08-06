/** Shared, client-safe types for the price comparison feature. */

export type CompareOffer = {
  /** Raw merchant/source name as reported by the provider. */
  storeRaw: string;
  /** Normalized, display-ready store name. */
  store: string;
  /** Merchant slug used for affiliate mapping. */
  merchant: string;
  title: string;
  price: number | null;
  priceLabel: string | null;
  shipping: string | null;
  offer: string | null;
  image: string | null;
  /** Original merchant product URL. */
  url: string;
  /** Affiliate-aware outbound URL used by the Buy button. */
  buyUrl: string;
  rating: number | null;
  reviews: number | null;
};

export type CompareResult = {
  /** The query actually sent to the provider. */
  query: string;
  /** True when the input was a product URL and the title was resolved from it. */
  resolvedFromUrl: boolean;
  /**
   * The product extracted from the pasted URL. Always pinned first in the UI
   * and used as the baseline for the savings figure. Null for text searches.
   */
  selected: CompareOffer | null;
  offers: CompareOffer[];
  /** Cheapest price found, if any. */
  lowestPrice: number | null;
  /** Highest price found, used for the "You Save" figure. */
  highestPrice: number | null;
  savings: number | null;
  error: string | null;
};