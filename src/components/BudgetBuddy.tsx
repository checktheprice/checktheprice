import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { budgetBuddyFn } from "@/lib/budget-buddy.functions";
import type { BudgetBuddyResult } from "@/lib/budget-buddy.types";

function parseBudget(value: string): number | null {
  const amount = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function BudgetBuddy() {
  const [product, setProduct] = useState("");
  const [budget, setBudget] = useState("");
  const [submittedBudget, setSubmittedBudget] = useState<number | null>(null);
  const searchBudgetBuddy = useServerFn(budgetBuddyFn);

  const mutation = useMutation<BudgetBuddyResult, Error, { query: string; budget: number }>({
    mutationFn: ({ query, budget }) => searchBudgetBuddy({ data: { query, budget } }),
    onSuccess: (_result, variables) => setSubmittedBudget(variables.budget),
  });

  const budgetValue = useMemo(() => parseBudget(budget), [budget]);
  const budgetResult = mutation.data;

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
          {mutation.isPending ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <div key={i} className="h-28 w-full animate-pulse rounded-xl bg-muted" />)}
            </div>
          ) : budgetResult?.offers.length ? (
            <div className="space-y-3">
              <div className="rounded-xl border bg-primary/5 p-4">
                <p className="text-sm font-bold">🎯 Budget Buddy found {budgetResult.offers.length} suitable products</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  All shown products are within your ₹{Math.round(budgetResult.budget).toLocaleString("en-IN")} budget.
                </p>
              </div>
              {budgetResult.offers.map((offer, index) => (
                <div key={`${offer.merchant}-${offer.url}-${index}`} className="flex gap-3 rounded-xl border bg-card p-3">
                  <div className="shrink-0">
                    {offer.image ? (
                      <img src={offer.image} alt={offer.title} loading="lazy" className="h-[84px] w-[84px] rounded-lg border object-contain p-1" />
                    ) : <div className="h-[84px] w-[84px] rounded-lg border bg-muted" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/70">{offer.store}</span>
                      {offer.badge && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">{offer.badge}</span>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">{offer.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {offer.rating != null && <span>★ {offer.rating}{offer.reviews != null ? ` (${offer.reviews})` : ""}</span>}
                      {offer.reason && <span>• {offer.reason}</span>}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-lg font-extrabold">₹{Math.round(offer.price ?? 0).toLocaleString("en-IN")}</span>
                      <Button asChild size="sm" className="h-8 font-semibold">
                        <a href={offer.buyUrl} target="_blank" rel="nofollow sponsored noopener noreferrer">
                          Buy Now <ExternalLink className="ml-1 h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {budgetResult?.error ?? "No suitable products found."}
            </div>
          )
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