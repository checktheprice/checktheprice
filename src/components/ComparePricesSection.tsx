import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PriceComparison } from "@/components/PriceComparison";
import { comparePricesFn } from "@/lib/compare/compare.functions";
import type { CompareResult } from "@/lib/compare/types";

export const COMPARE_TITLE = "Check the Price Before You Buy";
export const COMPARE_SUBTITLE =
  "Compare prices across Amazon, Flipkart, Croma, Reliance Digital, Tata CLiQ, Vijay Sales, JioMart and more to find the lowest price in seconds.";
export const COMPARE_PLACEHOLDER =
  "Search any product or paste an Amazon/Flipkart product URL";

/**
 * Reusable price comparison tool (search box + results).
 * Used by both the /compare page and the homepage — the backend logic
 * (comparePricesFn) and the results renderer (PriceComparison) are shared,
 * so there is no duplicated comparison code.
 *
 * variant="section" renders the full band with its own heading (used on
 * /compare). variant="bare" renders only the search box + results, for pages
 * that already provide the hero heading (the homepage).
 */
export function ComparePricesSection({
  headingLevel = "h2",
  className = "",
  variant = "section",
}: {
  headingLevel?: "h1" | "h2";
  className?: string;
  variant?: "section" | "bare";
}) {
  const [query, setQuery] = useState("");
  const compare = useServerFn(comparePricesFn);

  const mutation = useMutation<CompareResult, Error, string>({
    mutationFn: (q) => compare({ data: { query: q } }),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    mutation.mutate(q);
  }

  const Heading = headingLevel;
  const hasResults =
    mutation.isPending || mutation.isError || !!mutation.data;

  const form = (
    <form
      onSubmit={onSubmit}
      className="mx-auto flex w-full max-w-2xl flex-col gap-2 sm:flex-row"
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={COMPARE_PLACEHOLDER}
          aria-label={COMPARE_PLACEHOLDER}
          className="h-11 pl-9"
          maxLength={300}
        />
      </div>
      <Button
        type="submit"
        className="h-11 px-6 font-bold"
        disabled={mutation.isPending || query.trim().length < 2}
      >
        {mutation.isPending ? "Comparing…" : "Compare Prices"}
      </Button>
    </form>
  );

  /* Results only appear after a search — initially just the search box. */
  const results = hasResults ? (
    <div className="mt-6 text-left">
      {mutation.isError && (
        <div className="mb-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Something went wrong while comparing prices. Please try again.
        </div>
      )}
      <PriceComparison
        result={mutation.data ?? null}
        loading={mutation.isPending}
      />
    </div>
  ) : null;

  if (variant === "bare") {
    return (
      <div id="compare" className={className}>
        {form}
        {results}
      </div>
    );
  }

  return (
    <section
      id="compare"
      className={`border-b bg-gradient-to-b from-primary/10 to-background ${className}`}
    >
      <div className="mx-auto max-w-3xl px-4 py-8 text-center sm:py-10">
        <Heading className="text-2xl font-extrabold tracking-tight sm:text-4xl">
          {COMPARE_TITLE}
        </Heading>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {COMPARE_SUBTITLE}
        </p>

        <div className="mt-6">{form}</div>
        {results}
      </div>
    </section>
  );
}

