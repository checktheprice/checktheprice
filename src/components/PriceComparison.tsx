import { ExternalLink, Trophy, Truck, BadgePercent, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketplaceLogo } from "@/components/MarketplaceLogo";
import { getMarketplace } from "@/lib/marketplace";
import type { CompareOffer, CompareResult } from "@/lib/compare/types";

function inr(n: number | null): string {
  if (n == null) return "—";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function OfferRow({
  offer,
  isLowest,
}: {
  offer: CompareOffer;
  isLowest: boolean;
}) {
  const marketplace = getMarketplace(offer.url);

  return (
    <div
      className={`flex gap-3 rounded-xl border bg-card p-3 transition-shadow hover:shadow-md ${
        isLowest ? "border-primary ring-1 ring-primary/40" : ""
      }`}
    >
      <div className="shrink-0">
        {offer.image ? (
          <img
            src={offer.image}
            alt={offer.title}
            loading="lazy"
            className="h-[84px] w-[84px] rounded-lg border object-contain p-1"
          />
        ) : (
          <div className="h-[84px] w-[84px] rounded-lg border bg-muted" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/70">
              {offer.store}
            </span>
            {marketplace !== "other" && (
              <MarketplaceLogo marketplace={marketplace} size="sm" />
            )}
            {isLowest && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                <Trophy className="h-3 w-3" /> Lowest
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">
            {offer.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {offer.shipping && (
              <span className="inline-flex items-center gap-1">
                <Truck className="h-3 w-3" /> {offer.shipping}
              </span>
            )}
            {offer.offer && (
              <span className="inline-flex items-center gap-1 font-medium text-primary">
                <BadgePercent className="h-3 w-3" /> {offer.offer}
              </span>
            )}
            {offer.rating != null && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3" /> {offer.rating}
                {offer.reviews != null ? ` (${offer.reviews})` : ""}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-end justify-between gap-2">
          <span className="text-lg font-extrabold tracking-tight">
            {offer.price != null ? inr(offer.price) : (offer.priceLabel ?? "—")}
          </span>
          <Button asChild size="sm" className="h-8 font-semibold">
            <a
              href={offer.buyUrl}
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
            >
              Buy Now <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PriceComparison({
  result,
  loading,
}: {
  result: CompareResult | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[110px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!result) return null;

  if (result.error && result.offers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        {result.error}
      </div>
    );
  }

  const lowest = result.lowestPrice;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border bg-primary/5 p-4">
        <p className="text-sm font-bold">
          🏆 Lowest Price Today: {inr(lowest)}
        </p>
        {result.savings != null && (
          <p className="mt-1 text-sm font-semibold text-emerald-600">
            You Save {inr(result.savings)}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {result.offers.length} offers compared for “{result.query}”
          {result.resolvedFromUrl ? " (read from your link)" : ""}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {result.offers.map((o, i) => (
          <OfferRow
            key={`${o.merchant}-${o.url}-${i}`}
            offer={o}
            isLowest={o.price != null && o.price === lowest}
          />
        ))}
      </div>
    </div>
  );
}
