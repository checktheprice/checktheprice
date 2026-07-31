import { paapiRequest } from "./client";
import { GET_ITEMS_RESOURCES } from "./resources";
import { normalizeItem, type NormalizedProduct, type PaapiItem } from "./normalize";
import { throttled, withRetry } from "./throttle";
import { cacheGet, cacheSet } from "./cache";

type PaapiGetItemsResponse = {
  ItemsResult?: { Items?: PaapiItem[] };
  Errors?: Array<{ Code: string; Message: string }>;
};

const BATCH = 10; // PA API GetItems hard limit

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
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
        paapiRequest<PaapiGetItemsResponse>("GetItems", {
          ItemIds: batch,
          Resources: GET_ITEMS_RESOURCES,
          ItemIdType: "ASIN",
        }),
      ),
    );
    for (const item of data.ItemsResult?.Items ?? []) {
      const n = normalizeItem(item);
      cacheSet(`getitems:${n.asin}`, n);
      results.push(n);
    }
  }

  return results;
}
