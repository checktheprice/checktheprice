import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Tag, TrendingDown, Flame, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DealCard } from "@/components/DealCard";
import { PriceAlertModal } from "@/components/PriceAlertModal";
import { fetchDeals, calcDiscount, type Deal } from "@/lib/deals";
import { fetchDbDeals } from "@/lib/db-deals";
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
import {
  ComparePricesSection,
  COMPARE_SUBTITLE,
} from "@/components/ComparePricesSection";
import { normalizeCategory, sortCategoriesForDisplay } from "@/lib/categories";

const dealsQueryOptions = queryOptions({
  queryKey: ["deals"],
  queryFn: fetchDeals,
  staleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
  retry: 1,
});

const dbDealsQueryOptions = queryOptions({
  queryKey: ["deals", "db"],
  queryFn: fetchDbDeals,
  staleTime: 60_000,
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
    try {
      await context.queryClient.ensureQueryData(dbDealsQueryOptions);
    } catch (e) {
      console.error("[db-deals] loader prefetch failed", e);
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
  const { data: dbDeals } = useQuery({
    ...dbDealsQueryOptions,
    refetchOnWindowFocus: false,
  });
  const deals = useMemo<Deal[]>(() => {
    const sheetDeals = data?.deals ?? [];
    const website = dbDeals ?? [];
    // DB deals first (they're admin-curated and fresh), then sheet deals.
    return [...website, ...sheetDeals];
  }, [data, dbDeals]);

  const { discount: discountRange } = Route.useSearch();

  const [category, setCategory] = useState<string>("All");
  const [filter, setFilter] = useState<"all" | "hot">("all");
  const [alertDeal, setAlertDeal] = useState<Deal | null>(null);

  // Categories are normalized for display so scraped variants ("Smartphones",
  // "Mobile Phones", …) collapse into one canonical chip.
  const categories = useMemo(() => {
    const set = new Set<string>();
    deals?.forEach((d) => set.add(normalizeCategory(d.category)));
    return ["All", ...sortCategoriesForDisplay(Array.from(set))];
  }, [deals]);

  // Deal data can differ between SSR and the first client render (the DB query
  // is client-only), so only render the derived chips after hydration.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const visibleCategories = hydrated ? categories : ["All"];

  const filtered = useMemo(() => {
    if (!deals) return [];
    const list = deals.filter((d) => {
      const matchCat =
        category === "All" || normalizeCategory(d.category) === category;
      const matchHot =
        filter === "all" || calcDiscount(d.mrp, d.onlinePrice) > 65;
      const matchDiscount =
        !discountRange ||
        inDiscountRange(calcDiscount(d.mrp, d.onlinePrice), discountRange);
      return matchCat && matchHot && matchDiscount;
    });
    return [...list].sort((a, b) => {
      const au = a.updatedAt;
      const bu = b.updatedAt;
      if (au && bu) return bu - au;
      if (au && !bu) return -1;
      if (!au && bu) return 1;
      return 0;
    });
  }, [deals, category, filter, discountRange]);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero (the only hero on the page) ───────────────────────────── */}
      <header className="relative overflow-hidden border-b">
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div className="mx-auto max-w-4xl px-4 pb-8 pt-8 text-center sm:pb-10 sm:pt-12">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card/80 px-3 py-1 text-xs font-semibold text-muted-foreground">
            <Tag className="h-3.5 w-3.5" />
            Price comparison + daily loot
          </div>
          <h1
            className="text-3xl font-extrabold tracking-tight sm:text-5xl"
            style={{ color: "#ff9900" }}
          >
            Check the Price Before You Buy
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {COMPARE_SUBTITLE}
          </p>

          {/* Search box: product names or Amazon/Flipkart URLs.
              Comparison results render right below, only after a search. */}
          <div className="mt-6">
            <ComparePricesSection variant="bare" />
          </div>
        </div>
      </header>

      {/* ── Hot Loot ──────────────────────────────────────────────────── */}
      <section className="border-b bg-card/40">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Flame className="h-4 w-4 text-loot-hot" /> Hot Loot
            <span className="font-normal text-muted-foreground">
              — deals above 65% off
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => setFilter(filter === "hot" ? "all" : "hot")}
            className={`shrink-0 text-xs transition-all duration-200 ${
              filter === "hot"
                ? "bg-loot-hot hover:bg-loot-hot text-category-active-text font-bold shadow-md"
                : "bg-muted/50 border border-border/80 text-foreground hover:bg-muted hover:border-border font-medium shadow-sm"
            }`}
          >
            {filter === "hot" ? "Showing Hot Loot only" : "Show Hot Loot only"}
          </Button>
        </div>
      </section>

      {/* ── Categories (compact horizontal chips) ─────────────────────── */}
      <section
        id="categories"
        className="sticky top-[52px] z-10 border-b bg-background/90 backdrop-blur"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-1.5 overflow-x-auto px-4 py-2 no-scrollbar">
          {visibleCategories.map((c) => {
            const isActive = category === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-all duration-200 ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground font-bold shadow-sm"
                    : "border-border/80 bg-muted/40 text-foreground hover:bg-muted font-medium"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Latest Deals ─────────────────────────────────────────────── */}
      <main id="deals" className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">
            Latest Deals
          </h2>
          <LastUpdated />
        </div>
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

      {/* ── Trust + FAQ (footer is global) ────────────────────────────── */}
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
