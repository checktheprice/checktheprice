import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BudgetRecommendations } from "@/components/BudgetRecommendations";
import { discoverBudgetProductsFn } from "@/lib/budget-buddy/budget.functions";
import type { BudgetDiscoveryResult } from "@/lib/budget-buddy/types";

function parseBudget(value: string): number | null {
  const amount = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function BudgetBuddy() {
  const [product, setProduct] = useState("");
  const [budget, setBudget] = useState("");
  const discover = useServerFn(discoverBudgetProductsFn);

  const mutation = useMutation<BudgetDiscoveryResult, Error, { query: string; budget: number }>({
    mutationFn: ({ query, budget: amount }) => discover({ data: { query, budget: amount } }),
  });

  const budgetValue = useMemo(() => parseBudget(budget), [budget]);
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

      {(mutation.isPending || mutation.data) && (
        <div className="mt-5">
          <BudgetRecommendations result={mutation.data ?? null} loading={mutation.isPending} />
        </div>
      )}

      {mutation.isError && (
        <p className="mt-4 text-center text-sm text-destructive">
          {mutation.error.message || "Could not search for products. Please try again."}
        </p>
      )}
    </div>
  );
}
