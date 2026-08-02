import { creatorsRequest } from "./client";
import { GET_ITEMS_RESOURCES } from "./resources";
import { normalizeItem, type NormalizedProduct, type CreatorsItem } from "./normalize";
import { throttled, withRetry } from "./throttle";
import { cacheGet, cacheSet } from "./cache";

type CreatorsGetItemsResponse = {
  itemResults?: { items?: CreatorsItem[] };
  ItemsResult?: { Items?: CreatorsItem[] };
  errors?: Array<{ code?: string; message?: string }>;
};

const BATCH = 10; // Creators API GetItems hard limit

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function itemsOf(data: CreatorsGetItemsResponse): CreatorsItem[] {
  return data.itemResults?.items ?? data.ItemsResult?.Items ?? [];
}

export async function getItems(asins: string[]): Promise<NormalizedProduct[]> {
  const unique = Array.from(new Set(asins.filter(Boolean)));
  if (unique.length === 0) return [];

  const results: NormalizedProduct[] = [];
  const missing: string[] = [];
  for (const a of unique) {
    const hit = cacheGet<NormalizedProduct>(`getitems:${a}`);
    if (hit) results.push(hit);
    else missing.push(a);
  }

  for (const batch of chunk(missing, BATCH)) {
    const data = await throttled("GetItems", () =>
      withRetry(() =>
        creatorsRequest<CreatorsGetItemsResponse>("GetItems", {
          itemIds: batch,
          itemIdType: "ASIN",
          resources: GET_ITEMS_RESOURCES,
        }),
      ),
    );
    for (const item of itemsOf(data)) {
      const n = normalizeItem(item);
      if (!n.asin) continue;
      cacheSet(`getitems:${n.asin}`, n);
      results.push(n);
    }
  }

  return results;
}
