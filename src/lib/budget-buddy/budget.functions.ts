import { createServerFn } from "@tanstack/react-start";
import type { BudgetDiscoveryResult } from "./types";

export const discoverBudgetProductsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { query: string; budget: number }) => ({
    query: String(data?.query ?? "").slice(0, 160),
    budget: Number(data?.budget),
  }))
  .handler(async ({ data }): Promise<BudgetDiscoveryResult> => {
    const apiKey = process.env["GEMINI_API_KEY"];
    const { discoverBudgetProducts } = await import("./product-discovery.server");
    return discoverBudgetProducts({
      query: data.query,
      budget: data.budget,
      apiKey,
    });
  });