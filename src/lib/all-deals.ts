import { fetchDeals, slugifyTitle, type Deal } from "@/lib/deals";
import { fetchDbDeals } from "@/lib/db-deals";

/**
 * Single source of truth for every publicly visible deal.
 *
 * Combines admin-saved deals from the database ("Save to Website") with the
 * Google Sheet feed, de-duplicated by slug (database wins). RSS, the sitemap
 * and the deal detail page all read through this so a newly saved deal is
 * immediately live everywhere.
 */
export async function fetchAllDeals(): Promise<Deal[]> {
  const [dbResult, sheetResult] = await Promise.allSettled([
    fetchDbDeals(),
    fetchDeals(),
  ]);

  const dbDeals = dbResult.status === "fulfilled" ? dbResult.value : [];
  const sheetDeals =
    sheetResult.status === "fulfilled" ? sheetResult.value.deals : [];

  const seen = new Set<string>();
  const all: Deal[] = [];

  for (const deal of [...dbDeals, ...sheetDeals]) {
    const slug = slugifyTitle(deal.title);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    all.push(deal);
  }

  return all;
}
