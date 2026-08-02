import { creatorsRequest } from "./client";
import { VARIATIONS_RESOURCES } from "./resources";
import { normalizeItem, type NormalizedProduct, type CreatorsItem } from "./normalize";
import { throttled, withRetry } from "./throttle";

type CreatorsVariationsResponse = {
  variationsResult?: { items?: CreatorsItem[]; variationCount?: number };
  VariationsResult?: { Items?: CreatorsItem[]; VariationCount?: number };
  errors?: Array<{ code?: string; message?: string }>;
};

/** All variations (size/colour/etc.) of a parent ASIN. */
export async function getVariations(
  asin: string,
  page = 1,
): Promise<{ items: NormalizedProduct[]; variationCount?: number }> {
  const data = await throttled("GetVariations", () =>
    withRetry(() =>
      creatorsRequest<CreatorsVariationsResponse>("GetVariations", {
        asin: asin.toUpperCase(),
        variationPage: Math.min(Math.max(page, 1), 10),
        resources: VARIATIONS_RESOURCES,
      }),
    ),
  );

  const items = data.variationsResult?.items ?? data.VariationsResult?.Items ?? [];
  return {
    items: items.map(normalizeItem),
    variationCount: data.variationsResult?.variationCount ?? data.VariationsResult?.VariationCount,
  };
}
