import { creatorsRequest } from "./client";
import { SEARCH_ITEMS_RESOURCES } from "./resources";
import { normalizeItem, type NormalizedProduct, type CreatorsItem } from "./normalize";
import { throttled, withRetry } from "./throttle";

type CreatorsSearchResponse = {
  searchResult?: { items?: CreatorsItem[]; totalResultCount?: number };
  SearchResult?: { Items?: CreatorsItem[]; TotalResultCount?: number };
  errors?: Array<{ code?: string; message?: string }>;
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
      creatorsRequest<CreatorsSearchResponse>("SearchItems", {
        keywords: args.keywords,
        searchIndex: args.searchIndex ?? "All",
        itemCount: Math.min(Math.max(args.itemCount ?? 10, 1), 10),
        itemPage: Math.min(Math.max(args.itemPage ?? 1, 1), 10),
        resources: SEARCH_ITEMS_RESOURCES,
      }),
    ),
  );

  const items = data.searchResult?.items ?? data.SearchResult?.Items ?? [];
  return {
    items: items.map(normalizeItem),
    totalResults: data.searchResult?.totalResultCount ?? data.SearchResult?.TotalResultCount,
  };
}
