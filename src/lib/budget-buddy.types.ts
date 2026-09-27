import type { CompareOffer } from "@/lib/compare/types";

export type BudgetBuddyOffer = CompareOffer & {
  reason?: string | null;
  badge?: string | null;
};

export type BudgetBuddyResult = {
  query: string;
  budget: number;
  offers: BudgetBuddyOffer[];
  source: "gemini";
  error: string | null;
};
