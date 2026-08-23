import { normalizeCategory } from "@/lib/categories";

/**
 * Use the marketplace category supplied by the scraper (Amazon for Amazon
 * products) as the source of truth.
 *
 * The product title is deliberately NOT used to invent or override a
 * category. The marketplace category is normalized into our fixed category
 * list, and unknown categories safely fall back to "Other".
 *
 * Keep this function name for compatibility with existing callers.
 */
export function classifyProductCategory(
  _title: string,
  scrapedCategory: string | null | undefined,
): string {
  return normalizeCategory(scrapedCategory);
}
