/**
 * SerpApi service (server only).
 * Reads SERPAPI_API_KEY from the environment inside the call — never at module
 * scope — and never returns the key to callers.
 */

export type SerpShoppingResult = {
  title?: string;
  link?: string;
  product_link?: string;
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
};

export type SerpShoppingResponse = {
  error?: string;
  shopping_results?: SerpShoppingResult[];
  inline_shopping_results?: SerpShoppingResult[];
  immersive_products?: SerpShoppingResult[];
};

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

export function hasSerpApiKey(): boolean {
  return Boolean(process.env["SERPAPI_API_KEY"]);
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
      };
    }
    return body ?? { error: "Empty response from the price provider." };
  } catch (e) {
    console.error("[serpapi] network error", e);
    return { error: "Could not reach the price provider. Please try again." };
  }
}