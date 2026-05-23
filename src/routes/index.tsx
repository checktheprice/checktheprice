import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Tag, Sparkles, TrendingDown, Flame } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DealCard } from "@/components/DealCard";
import { PriceAlertModal } from "@/components/PriceAlertModal";
import { fetchDeals, calcDiscount, type Deal } from "@/lib/deals";

export const Route = createFileRoute("/")({
  component: Index,
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

function Index() {
  const { data: deals, isLoading, error } = useQuery({
    queryKey: ["deals"],
    queryFn: fetchDeals,
    refetchOnWindowFocus: false,
  });

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
