import { createServerFn } from "@tanstack/react-start";
import type { CompareResult } from "./types";

export const comparePricesFn = createServerFn({ method: "POST" })
  .inputValidator((data: { query: string }) => ({
    query: String(data?.query ?? "").slice(0, 300),
  }))
  .handler(async ({ data }): Promise<CompareResult> => {
    const { comparePrices } = await import("./product-search.server");
    return comparePrices(data.query);
  });