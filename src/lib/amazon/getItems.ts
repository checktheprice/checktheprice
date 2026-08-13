import { creatorsRequest } from "./client";
import { GET_ITEMS_RESOURCES } from "./resources";
import { normalizeItem, type NormalizedProduct, type CreatorsItem } from "./normalize";
import { throttled, withRetry } from "./throttle";
import { cacheGet, cacheSet } from "./cache";

type CreatorsApiError = { code?: string; message?: string; type?: string };

type CreatorsGetItemsResponse = {
  // Current Creators API shape.
  itemsResult?: { items?: CreatorsItem[] };
  // Older / alternate shapes kept for backwards compatibility.
  itemResults?: { items?: CreatorsItem[] };
  ItemsResult?: { Items?: CreatorsItem[] };
  errors?: CreatorsApiError[];
  Errors?: CreatorsApiError[];
};

const BATCH = 10; // Creators API GetItems hard limit

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function itemsOf(data: CreatorsGetItemsResponse): CreatorsItem[] {
  return data.itemsResult?.items ?? data.itemResults?.items ?? data.ItemsResult?.Items ?? [];
}

function logErrors(op: string, batch: string[], data: CreatorsGetItemsResponse): CreatorsApiError[] {
  const errors = data.errors ?? data.Errors ?? [];
  for (const e of errors) {
    console.error(
      `[amazon] ${op} error code=${e.code ?? e.type ?? "unknown"} message=${e.message ?? "n/a"} asins=${batch.join(",")}`,
    );
  }
  return errors;
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
    console.log(`[amazon] GetItems requesting ${batch.length} ASIN(s): ${batch.join(",")}`);
    const data = await throttled("GetItems", () =>
      withRetry(() =>
        creatorsRequest<CreatorsGetItemsResponse>("GetItems", {
          itemIds: batch,
          itemIdType: "ASIN",
          resources: GET_ITEMS_RESOURCES,
        }),
      ),
    );

    const errors = logErrors("GetItems", batch, data);
    const items = itemsOf(data);
    console.log(`[amazon] GetItems returned ${items.length} item(s) for ${batch.length} ASIN(s)`);

    // Never let a hard API failure masquerade as "zero products found".
    if (items.length === 0 && errors.length > 0) {
      const first = errors[0];
      const err = new Error(
        `Creators API GetItems failed: ${first.code ?? first.type ?? "unknown"} - ${first.message ?? "no message"}`,
      );
      throw err;
    }

    for (const item of items) {
      const n = normalizeItem(item);
      if (!n.asin) {
        console.warn("[amazon] GetItems item without ASIN skipped");
        continue;
      }
      cacheSet(`getitems:${n.asin}`, n);
      results.push(n);
    }
  }

  return results;
}
