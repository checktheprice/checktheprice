import { paapiRequest } from "./client";
import { SEARCH_ITEMS_RESOURCES } from "./resources";
import { normalizeItem, type NormalizedProduct, type PaapiItem } from "./normalize";
import { throttled, withRetry } from "./throttle";

type PaapiSearchResponse = {
  SearchResult?: { Items?: PaapiItem[]; TotalResultCount?: number };
  Errors?: Array<{ Code: string; Message: string }>;
};

export type SearchArgs = {
  keywords: string;
  searchIndex?: string;
  itemCount?: number;
  itemPage?: number;
};

export async function searchItems(
  args: SearchArgs,
): Promise<{ items: NormalizedProduct[]; totalResults?: number }> {
  const data = await throttled("SearchItems", () =>
    withRetry(() =>
      paapiRequest<PaapiSearchResponse>("SearchItems", {
        Keywords: args.keywords,
        SearchIndex: args.searchIndex ?? "All",
        ItemCount: Math.min(Math.max(args.itemCount ?? 10, 1), 10),
        ItemPage: Math.min(Math.max(args.itemPage ?? 1, 1), 10),
        Resources: SEARCH_ITEMS_RESOURCES,
      }),
    ),
  );

  return {
    items: (data.SearchResult?.Items ?? []).map(normalizeItem),
    totalResults: data.SearchResult?.TotalResultCount,
  };
}
