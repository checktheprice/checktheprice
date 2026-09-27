import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriceComparison } from "@/components/PriceComparison";
import { comparePricesFn } from "@/lib/compare/compare.functions";
import type { CompareResult } from "@/lib/compare/types";

function parseBudget(value: string): number | null {
  const amount = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function rankForBudget(
  price: number,
  budget: number,
  rating: number | null,
  reviews: number | null,
): number {
  const ratingScore = rating == null ? 0 : Math.min(rating / 5, 1) * 0.6;
  const reviewScore = reviews == null ? 0 : Math.min(Math.log10(reviews + 1) / 6, 1) * 0.2;
  const valueScore = Math.max(0, 1 - price / budget) * 0.2;
  return ratingScore + reviewScore + valueScore;
}

function withinBudget(result: CompareResult, budget: number): CompareResult {
  const offers = result.offers
    .filter((offer) => offer.price != null && offer.price <= budget)
    .sort((a, b) => {
      const aScore = rankForBudget(a.price ?? budget, budget, a.rating, a.reviews);
      const bScore = rankForBudget(b.price ?? budget, budget, b.rating, b.reviews);
      return bScore - aScore;
    });
  const prices = offers.flatMap((offer) => (offer.price == null ? [] : [offer.price]));

  return {
    ...result,
    offers,
    lowestPrice: prices.length ? Math.min(...prices) : null,
    highestPrice: prices.length ? Math.max(...prices) : null,
    savings: null,
    error: offers.length ? null : `No matching products found within ₹${Math.round(budget).toLocaleString("en-IN")}.`,
  };
}

export function BudgetBuddy() {
  const [product, setProduct] = useState("");
  const [budget, setBudget] = useState("");
  const [submittedBudget, setSubmittedBudget] = useState<number | null>(null);
  const compare = useServerFn(comparePricesFn);

  const mutation = useMutation<CompareResult, Error, { query: string; budget: number }>({
    mutationFn: ({ query }) => compare({ data: { query } }),
    onSuccess: (_result, variables) => setSubmittedBudget(variables.budget),
  });

  const budgetValue = useMemo(() => parseBudget(budget), [budget]);
  const budgetResult =
    mutation.data && submittedBudget != null
      ? withinBudget(mutation.data, submittedBudget)
      : null;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = product.trim();
    const amount = parseBudget(budget);
    if (query.length < 2 || amount == null) return;
    mutation.mutate({ query, budget: amount });
  }

  return (
    <div className="mx-auto w-full max-w-2xl text-left">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_0.7fr]">
          <label className="text-left text-xs font-semibold text-foreground">
            <span className="mb-1.5 block">What are you looking for?</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={product}
                onChange={(event) => setProduct(event.target.value)}
                placeholder="e.g. smartphone, laptop, earbuds"
                aria-label="What are you looking for?"
                className="h-10 pl-9"
                maxLength={200}
              />
            </div>
          </label>
          <label className="text-left text-xs font-semibold text-foreground">
            <span className="mb-1.5 block">What's your budget?</span>
            <div className="relative">
              <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                placeholder="₹20,000"
                aria-label="What's your budget?"
                inputMode="decimal"
                className="h-10 pl-9"
              />
            </div>
          </label>
        </div>
        <Button
          type="submit"
          className="h-10 w-full font-bold sm:w-auto sm:px-8"
          disabled={mutation.isPending || product.trim().length < 2 || budgetValue == null}
        >
          {mutation.isPending ? "Finding products…" : "Find Best Products"}
        </Button>
      </form>

      {(mutation.isPending || budgetResult) && (
        <div className="mt-5">
          {budgetResult && submittedBudget != null && (
            <p className="mb-3 text-xs font-semibold text-muted-foreground">
              Showing suitable matches priced at or below ₹{Math.round(submittedBudget).toLocaleString("en-IN")}.
            </p>
          )}
          <PriceComparison result={budgetResult} loading={mutation.isPending} />
        </div>
      )}

      {mutation.isError && (
        <p className="mt-4 text-center text-sm text-destructive">
          Something went wrong while finding products. Please try again.
        </p>
      )}
    </div>
  );
}