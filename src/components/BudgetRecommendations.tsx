import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketplaceLogo } from "@/components/MarketplaceLogo";
import { getMarketplace } from "@/lib/marketplace";
import type { BudgetDiscoveryResult, BudgetRecommendation } from "@/lib/budget-buddy/types";

function rupees(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function Recommendation({ product }: { product: BudgetRecommendation }) {
  const marketplace = getMarketplace(product.url);

  return (
    <article className="flex min-w-0 items-center gap-3 rounded-md border bg-card p-3 sm:gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
        {marketplace !== "other" ? (
          <MarketplaceLogo marketplace={marketplace} size="sm" />
        ) : (
          <span className="text-xs font-semibold text-muted-foreground">Store</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-muted-foreground">{product.store}</p>
        <h3 className="mt-1 line-clamp-2 break-words text-sm font-medium leading-snug text-foreground">
          {product.title}
        </h3>
        <p className="mt-2 text-lg font-bold text-foreground">{rupees(product.price)}</p>
      </div>
      <Button asChild size="sm" className="shrink-0 font-semibold">
        <a
          href={product.buyUrl}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          aria-label={`Buy ${product.title} from ${product.store}`}
        >
          Buy Now <ExternalLink className="ml-1 h-3.5 w-3.5" />
        </a>
      </Button>
    </article>
  );
}

export function BudgetRecommendations({
  result,
  loading,
}: {
  result: BudgetDiscoveryResult | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-label="Searching for products">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-28 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (!result) return null;

  return (
    <section aria-live="polite" className="space-y-3">
      <h2 className="text-base font-bold text-foreground">Recommended for your budget</h2>
      {result.error && result.products.length === 0 ? (
        <p className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">
          {result.error}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {result.products.map((product) => (
            <Recommendation key={product.url} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}