import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PriceComparison } from "@/components/PriceComparison";
import { comparePricesFn } from "@/lib/compare/compare.functions";
import type { CompareResult } from "@/lib/compare/types";

const TITLE = "Check the Price Before You Buy | CheckThePrice";
const DESC =
  "Compare prices across Amazon, Flipkart, Croma, Reliance Digital, Tata CLiQ, Vijay Sales, JioMart and more to find the lowest price in seconds.";

export const Route = createFileRoute("/compare")({
  component: ComparePage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: "Check the Price Before You Buy" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ComparePage() {
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="border-b bg-gradient-to-b from-primary/10 to-background">
        <div className="mx-auto max-w-3xl px-4 py-10 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">
            Check the Price Before You Buy
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Compare prices across Amazon, Flipkart, Croma, Reliance Digital,
            Tata CLiQ, Vijay Sales, JioMart, and other supported stores to find
            the lowest price in seconds.
          </p>

          <form
            onSubmit={onSubmit}
            className="mx-auto mt-6 flex max-w-2xl flex-col gap-2 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search any product or paste an Amazon/Flipkart product URL"
                aria-label="Search any product or paste an Amazon/Flipkart product URL"
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
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {mutation.isError && (
          <div className="mb-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Something went wrong while comparing prices. Please try again.
          </div>
        )}
        <PriceComparison
          result={mutation.data ?? null}
          loading={mutation.isPending}
        />
      </main>

      <Footer />
    </div>
  );
}