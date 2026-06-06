import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Search, Tag, Sparkles, TrendingDown, Flame, Bug } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DealCard } from "@/components/DealCard";
import { PriceAlertModal } from "@/components/PriceAlertModal";
import { fetchDeals, calcDiscount, type Deal, type FetchDebugInfo } from "@/lib/deals";

const dealsQueryOptions = queryOptions({
  queryKey: ["deals"],
  queryFn: fetchDeals,
  staleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
  retry: 1,
});

export const Route = createFileRoute("/")({
  component: Index,
  // Prime the cache server-side so deals are baked into SSR HTML.
  // Without this, every refresh shows skeletons and relies on a
  // successful client-side fetch — which can silently fail in prod.
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(dealsQueryOptions);
    } catch (e) {
      console.error("[deals] loader prefetch failed", e);
    }
  },
  head: () => ({
    meta: [
      { title: "CheckThePrice — Hottest Online Deals & Loot Alerts" },
      {
        name: "description",
        content:
          "Discover hand-picked online deals with visual Loot Meter scoring, local-shop price comparison, and instant price drop alerts.",
      },
    ],
  }),
});

function DebugPanel({
  debug,
  isLoading,
  error,
}: {
  debug: FetchDebugInfo | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  if (!debug) return null;
  return (
    <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm">
      <div className="mb-2 flex items-center gap-2 font-semibold text-yellow-600">
        <Bug className="h-4 w-4" />
        Debug Panel
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <span className="text-muted-foreground">Sheet ID:</span>{" "}
          <span className="break-all font-mono text-foreground">{debug.sheetId}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Sheet Name:</span>{" "}
          <span className="font-mono text-foreground">{debug.sheetName}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Status:</span>{" "}
          <span className={`font-mono font-bold ${debug.status === 200 ? "text-green-600" : debug.status ? "text-red-600" : "text-muted-foreground"}`}>
            {isLoading ? "Loading…" : debug.status ?? "—"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Deals Fetched:</span>{" "}
          <span className="font-mono text-foreground">{debug.rowCount}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Timestamp:</span>{" "}
          <span className="font-mono text-foreground">{debug.timestamp}</span>
        </div>
        {debug.error && (
          <div className="col-span-full">
            <span className="text-muted-foreground">Error:</span>{" "}
            <span className="font-mono text-destructive">{debug.error}</span>
          </div>
        )}
        {error && (
          <div className="col-span-full">
            <span className="text-muted-foreground">React Query Error:</span>{" "}
            <span className="font-mono text-destructive">{error.message}</span>
          </div>
        )}
        <div className="col-span-full">
          <span className="text-muted-foreground">Fetch URL:</span>{" "}
          <a
            href={debug.url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-mono text-primary underline"
          >
            {debug.url}
          </a>
        </div>
      </div>
    </div>
  );
}

function Index() {
  const { data, isLoading, error } = useQuery({
    ...dealsQueryOptions,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  const deals = data?.deals ?? [];
  const debug = data?.debug;

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [filter, setFilter] = useState<"all" | "hot">("all");
  const [alertDeal, setAlertDeal] = useState<Deal | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>(["All"]);
    deals?.forEach((d) => set.add(d.category));
    return Array.from(set);
  }, [deals]);

  const filtered = useMemo(() => {
    if (!deals) return [];
    return deals.filter((d) => {
      const matchSearch = d.title
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchCat = category === "All" || d.category === category;
      const matchHot =
        filter === "all" || calcDiscount(d.mrp, d.onlinePrice) > 65;
      return matchSearch && matchCat && matchHot;
    });
  }, [deals, search, category, filter]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden border-b">
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "var(--gradient-hero)" }}
        />
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 text-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Tag className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              CheckThePrice
            </span>
          </div>
          <div className="hidden items-center gap-2 text-sm font-medium text-muted-foreground sm:flex">
            <Sparkles className="h-4 w-4" />
            <span>Updated daily</span>
          </div>
        </nav>

        <div className="mx-auto max-w-4xl px-6 pb-16 pt-8 text-center sm:pb-20 sm:pt-12">
          <h1
            className="text-5xl font-extrabold tracking-tight sm:text-7xl"
            style={{ color: "#ff9900" }}
          >
            CheckThePrice
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-semibold text-foreground sm:text-lg">
            🔥 Hottest Online Deals vs Offline Market Prices
          </p>
          <p className="mx-auto mt-1.5 max-w-2xl text-xs italic text-muted-foreground sm:text-sm">
            Loot meters are calculated automatically. Real-time updates via Google Sheets.
          </p>

          <div className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-full bg-card p-1.5 shadow-lg border">
            <Search className="ml-3 h-5 w-5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deals..."
              className="border-0 bg-transparent text-foreground shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
      </header>

      {/* Filters */}
      <section className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto px-6 py-3">
          <Button
            size="sm"
            onClick={() => setFilter(filter === "hot" ? "all" : "hot")}
            className={`shrink-0 transition-all duration-200 ${
              filter === "hot"
                ? "bg-loot-hot hover:bg-loot-hot text-category-active-text font-bold shadow-md scale-105"
                : "bg-muted/50 border border-border/80 text-foreground hover:bg-muted hover:border-border font-medium shadow-sm"
            }`}
          >
            <Flame className="mr-1 h-4 w-4" /> Hot Loot
          </Button>
          <div className="h-6 w-px bg-border" />
          {categories.map((c) => {
            const isActive = category === c;
            let activeClass =
              "bg-primary hover:bg-primary text-primary-foreground";
            if (c === "Electronics")
              activeClass =
                "bg-category-electronics hover:bg-category-electronics text-category-active-text";
            else if (c === "Wearables")
              activeClass =
                "bg-category-wearables hover:bg-category-wearables text-category-active-text";
            else if (c === "Fashion")
              activeClass =
                "bg-category-fashion hover:bg-category-fashion text-category-active-text";
            else if (c === "All")
              activeClass =
                "bg-category-all hover:bg-category-all text-category-active-text";

            return (
              <Button
                key={c}
                size="sm"
                onClick={() => setCategory(c)}
                className={`shrink-0 transition-all duration-200 ${
                  isActive
                    ? `${activeClass} font-bold shadow-md scale-105`
                    : "bg-muted/50 border border-border/80 text-foreground hover:bg-muted hover:border-border font-medium shadow-sm"
                }`}
              >
                {c}
              </Button>
            );
          })}
        </div>
      </section>

      {/* Grid */}
      <main className="mx-auto max-w-7xl px-6 py-10">
        <DebugPanel debug={debug} isLoading={isLoading} error={error} />

        {isLoading && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[480px] rounded-2xl" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <p className="font-semibold text-destructive">
              Couldn't load deals from the Google Sheet.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Make sure your sheet is shared as "Anyone with the link" and the
              ID in <code>src/lib/deals.ts</code> is correct.
            </p>
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="py-20 text-center text-muted-foreground">
            <TrendingDown className="mx-auto mb-3 h-10 w-10 opacity-40" />
            No deals match your filters.
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((d) => (
            <DealCard key={d.id} deal={d} onAlert={setAlertDeal} />
          ))}
        </div>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>
          © {new Date().getFullYear()} CheckThePrice — Powered by your Google
          Sheet
        </p>
      </footer>

      <PriceAlertModal
        deal={alertDeal}
        open={!!alertDeal}
        onOpenChange={(o) => !o && setAlertDeal(null)}
      />
    </div>
  );
}
