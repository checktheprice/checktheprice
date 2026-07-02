import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Search, Tag, Sparkles, TrendingDown, Flame, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DealCard } from "@/components/DealCard";
import { PriceAlertModal } from "@/components/PriceAlertModal";
import { fetchDeals, calcDiscount, type Deal } from "@/lib/deals";
import { TrustSection } from "@/components/TrustSection";
import { FAQ, faqJsonLd } from "@/components/FAQ";
import { LastUpdated } from "@/components/LastUpdated";
import {
  DISCOUNT_RANGES,
  type DiscountRangeId,
  inDiscountRange,
  discountRangeLabel,
} from "@/lib/discount-ranges";
import { Link } from "@tanstack/react-router";

const dealsQueryOptions = queryOptions({
  queryKey: ["deals"],
  queryFn: fetchDeals,
  staleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
  retry: 1,
});

export const Route = createFileRoute("/")({
  component: Index,
  validateSearch: (search: Record<string, unknown>) => {
    const d = typeof search.discount === "string" ? search.discount : undefined;
    const allowed = DISCOUNT_RANGES.map((r: { id: string }) => r.id);
    return {
      discount: (allowed as string[]).includes(d ?? "")
        ? (d as DiscountRangeId)
        : undefined,
    };
  },
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
      { property: "og:title", content: "CheckThePrice — Hottest Online Deals & Loot Alerts" },
      {
        property: "og:description",
        content:
          "Hand-picked online deals with Loot Meter scoring, local-shop price comparison, and instant alerts.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://checktheprice.vercel.app/" },
    ],
    links: [
      { rel: "canonical", href: "https://checktheprice.vercel.app/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(faqJsonLd),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "CheckThePrice",
          url: "https://checktheprice.vercel.app/",
          description:
            "Hand-picked online deals with Loot Meter scoring and local-shop price comparison.",
        }),
      },
    ],
  }),
});

function Index() {
  const { data, isLoading, error } = useQuery({
    ...dealsQueryOptions,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  const deals = data?.deals ?? [];

  const { discount: discountRange } = Route.useSearch();

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
      const matchDiscount =
        !discountRange ||
        inDiscountRange(calcDiscount(d.mrp, d.onlinePrice), discountRange);
      return matchSearch && matchCat && matchHot && matchDiscount;
    });
  }, [deals, search, category, filter, discountRange]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden border-b">
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "var(--gradient-hero)" }}
        />
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 text-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Tag className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight">
              CheckThePrice
            </span>
          </div>
          <div className="hidden items-center gap-2 text-xs font-medium text-muted-foreground sm:flex">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Updated daily</span>
          </div>
        </nav>

        <div className="mx-auto max-w-4xl px-4 pb-6 pt-3 text-center sm:pb-8 sm:pt-4">
          <h1
            className="text-3xl font-extrabold tracking-tight sm:text-5xl"
            style={{ color: "#ff9900" }}
          >
            CheckThePrice
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold text-foreground sm:text-base">
            🔥 Hottest Online Deals vs Offline Market Prices
          </p>

          <div className="mx-auto mt-4 flex max-w-xl items-center gap-2 rounded-full bg-card p-1 shadow-lg border">
            <Search className="ml-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deals..."
              className="border-0 bg-transparent text-sm text-foreground shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
      </header>

      {/* Filters - Horizontal scroll */}
      <section
        id="categories"
        className="sticky top-[52px] z-10 border-b bg-background/90 backdrop-blur"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2.5 no-scrollbar">
          <Button
            size="sm"
            onClick={() => setFilter(filter === "hot" ? "all" : "hot")}
            className={`shrink-0 transition-all duration-200 ${
              filter === "hot"
                ? "bg-loot-hot hover:bg-loot-hot text-category-active-text font-bold shadow-md scale-105"
                : "bg-muted/50 border border-border/80 text-foreground hover:bg-muted hover:border-border font-medium shadow-sm text-xs"
            }`}
          >
            <Flame className="mr-1 h-3.5 w-3.5" /> Hot Loot
          </Button>
          <div className="h-5 w-px bg-border shrink-0" />
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
                className={`shrink-0 transition-all duration-200 text-xs ${
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

      {/* Grid - One card per row */}
      <main id="deals" className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
        <LastUpdated />
        {discountRange && (
          <div className="mb-3 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs sm:text-sm">
            <span className="font-medium text-foreground">
              Filtering by discount:{" "}
              <span className="font-bold text-primary">
                {discountRangeLabel(discountRange)}
              </span>
            </span>
            <Link
              to="/"
              search={{ discount: undefined }}
              hash="deals"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              <X className="h-3 w-3" /> Clear
            </Link>
          </div>
        )}
        {isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[140px] rounded-xl w-full" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
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
          <div className="py-16 text-center text-muted-foreground">
            <TrendingDown className="mx-auto mb-3 h-10 w-10 opacity-40" />
            No deals match your filters.
          </div>
        )}

        <div className="flex flex-col gap-3">
          {filtered.map((d) => (
            <DealCard key={d.id} deal={d} onAlert={setAlertDeal} />
          ))}
        </div>
      </main>

      <TrustSection />
      <FAQ />

      <PriceAlertModal
        deal={alertDeal}
        open={!!alertDeal}
        onOpenChange={(o) => !o && setAlertDeal(null)}
      />
    </div>
  );
}
