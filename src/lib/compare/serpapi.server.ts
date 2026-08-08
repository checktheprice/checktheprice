/**
 * SerpApi service (server only).
 * Reads SERPAPI_API_KEY from the environment inside the call — never at module
 * scope — and never returns the key to callers.
 */

export type SerpShoppingResult = {
  title?: string;
  link?: string;
  product_link?: string;
  direct_link?: string;
  source?: string;
  source_icon?: string;
  price?: string;
  extracted_price?: number;
  old_price?: string;
  thumbnail?: string;
  delivery?: string;
  shipping?: string;
  tag?: string;
  badge?: string;
  rating?: number;
  reviews?: number;
  store_rating?: number;
  /** Token used by the Google Immersive Product API to resolve merchant URLs. */
  immersive_product_page_token?: string;
  serpapi_immersive_product_api?: string;
};

export type SerpShoppingResponse = {
  error?: string;
  /**
   * True when the failure is transient/provider-side (quota exceeded, rate
   * limit, timeout, service unavailable) and the caller may fall back to the
   * Firecrawl provider. Never set for configuration errors (missing/invalid
   * API key), which the fallback must not mask.
   */
  fallbackEligible?: boolean;
  shopping_results?: SerpShoppingResult[];
  inline_shopping_results?: SerpShoppingResult[];
  immersive_products?: SerpShoppingResult[];
};

/** Minimal shape of a store/seller entry across SerpApi product endpoints. */
export type SerpStoreEntry = {
  name?: string;
  merchant?: string;
  link?: string;
  direct_link?: string;
  base_link?: string;
  price?: string;
  extracted_price?: number;
};

export type SerpImmersiveProductResponse = {
  error?: string;
  product_results?: {
    stores?: SerpStoreEntry[];
    sellers_results?: { online_sellers?: SerpStoreEntry[] };
    link?: string;
  };
  stores?: SerpStoreEntry[];
  sellers_results?: { online_sellers?: SerpStoreEntry[] };
};

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

/** Abort SerpApi requests that hang; a timeout counts as fallback-eligible. */
const SERPAPI_TIMEOUT_MS = 15_000;

export function hasSerpApiKey(): boolean {
  return Boolean(process.env["SERPAPI_API_KEY"]);
}

/** Quota / throttle phrases SerpApi puts in its JSON `error` field. */
const TRANSIENT_ERROR_RE =
  /quota|rate.?limit|too many requests|out of searches|searches per month|try again later/i;

/** Transient provider failure → the Firecrawl fallback may take over. */
function isTransientFailure(status: number, providerError?: string): boolean {
  if (status === 429 || status >= 500) return true;
  return Boolean(providerError && TRANSIENT_ERROR_RE.test(providerError));
}

/** Run a Google Shopping search for the Indian marketplace. */
export async function serpApiGoogleShopping(
  query: string,
  opts: { num?: number } = {},
): Promise<SerpShoppingResponse> {
  const apiKey = process.env["SERPAPI_API_KEY"];
  if (!apiKey) {
    return { error: "SERPAPI_API_KEY is not configured on the server." };
  }

  const url = new URL(SERPAPI_ENDPOINT);
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", query);
  url.searchParams.set("gl", "in");
  url.searchParams.set("hl", "en");
  url.searchParams.set("google_domain", "google.co.in");
  url.searchParams.set("currency", "INR");
  url.searchParams.set("num", String(opts.num ?? 40));
  url.searchParams.set("api_key", apiKey);

  try {
    const res = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(SERPAPI_TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => null)) as
      | SerpShoppingResponse
      | null;
    if (!res.ok) {
      // Log provider detail server-side only; surface a safe message.
      console.error("[serpapi] request failed", res.status, body?.error);
      return {
        error:
          res.status === 401
            ? "Price comparison is temporarily unavailable (invalid API credentials)."
            : "Price comparison is temporarily unavailable. Please try again.",
        fallbackEligible: isTransientFailure(res.status, body?.error),
      };
    }
    // A 200 body can still carry a quota/rate-limit error message.
    if (body?.error && isTransientFailure(res.status, body.error)) {
      console.error("[serpapi] provider error", body.error);
      return { error: body.error, fallbackEligible: true };
    }
    return body ?? { error: "Empty response from the price provider." };
  } catch (e) {
    // Network failure or SERPAPI_TIMEOUT_MS abort — both fallback-eligible.
    console.error("[serpapi] network error", e);
    return {
      error: "Could not reach the price provider. Please try again.",
      fallbackEligible: true,
    };
  }
}

/**
 * Google Immersive Product API — used to resolve the real merchant product URL
 * for a Google Shopping result whose product_link is a Google redirect.
 */
export async function serpApiImmersiveProduct(
  pageToken: string,
): Promise<SerpImmersiveProductResponse> {
  const apiKey = process.env["SERPAPI_API_KEY"];
  if (!apiKey) return { error: "SERPAPI_API_KEY is not configured." };

  const url = new URL(SERPAPI_ENDPOINT);
  url.searchParams.set("engine", "google_immersive_product");
  url.searchParams.set("page_token", pageToken);
  url.searchParams.set("gl", "in");
  url.searchParams.set("hl", "en");
  url.searchParams.set("google_domain", "google.co.in");
  url.searchParams.set("currency", "INR");
  url.searchParams.set("api_key", apiKey);

  try {
    const res = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(SERPAPI_TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => null)) as
      | SerpImmersiveProductResponse
      | null;
    if (!res.ok) {
      console.error(
        "[serpapi] immersive product failed",
        res.status,
        body?.error,
      );
      return { error: "Could not resolve the merchant link." };
    }
    return body ?? { error: "Empty response from the price provider." };
  } catch (e) {
    console.error("[serpapi] immersive product network error", e);
    return { error: "Could not resolve the merchant link." };
  }
}

/** Collect every store/seller entry from an immersive product response. */
export function collectStoreEntries(
  body: SerpImmersiveProductResponse,
): SerpStoreEntry[] {
  return [
    ...(body.product_results?.stores ?? []),
    ...(body.product_results?.sellers_results?.online_sellers ?? []),
    ...(body.stores ?? []),
    ...(body.sellers_results?.online_sellers ?? []),
  ];
}
