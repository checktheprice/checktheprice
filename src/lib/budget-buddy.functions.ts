import { createServerFn } from "@tanstack/react-start";
import type { BudgetBuddyResult } from "./budget-buddy.types";

export const budgetBuddyFn = createServerFn({ method: "POST" })
  .inputValidator((data: { query: string; budget: number }) => ({
    query: String(data?.query ?? "").slice(0, 200),
    budget: Number(data?.budget ?? 0),
  }))
  .handler(async ({ data }): Promise<BudgetBuddyResult> => {
    const { findBudgetBuddyProducts } = await import("./budget-buddy.server");
    return findBudgetBuddyProducts(data.query, data.budget);
  });
