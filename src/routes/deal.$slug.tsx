import { createFileRoute, Link, useRouter, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { DealCard } from "@/components/DealCard";
import { PriceAlertModal } from "@/components/PriceAlertModal";
import { useState } from "react";
import { fetchDeals, slugifyTitle, type Deal, calcDiscount } from "@/lib/deals";

const dealsQueryOptions = queryOptions({
  queryKey: ["deals"],
  queryFn: fetchDeals,
  staleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
  retry: 1,
});

function findDeal(deals: Deal[], slug: string): Deal | undefined {
  return deals.find((d) => slugifyTitle(d.title) === slug);
}

export const Route = createFileRoute("/deal/$slug")({
  loader: async ({ context, params }) => {
    const { deals } = await context.queryClient.ensureQueryData(dealsQueryOptions);
    const deal = findDeal(deals, params.slug);
    if (!deal) throw notFound();
    return { slug: params.slug };
  },
  head: ({ params }) => ({
    meta: [
      { title: `Deal — CheckThePrice` },
      { name: "description", content: "View this hand-picked deal on CheckThePrice." },
      { property: "og:title", content: "Deal — CheckThePrice" },
      { property: "og:description", content: "View this hand-picked deal on CheckThePrice." },
      { property: "og:type", content: "product" },
      { property: "og:url", content: `https://checktheprice.lovable.app/deal/${params.slug}` },
    ],
    links: [
      { rel: "canonical", href: `https://checktheprice.lovable.app/deal/${params.slug}` },
    ],
  }),
  component: DealPage,
  notFoundComponent: DealNotFound,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-bold">Couldn't load this deal</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    );
  },
});

function DealNotFound() {
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-2xl font-bold text-foreground">Deal Not Found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This deal may have expired or been removed. Check out our latest deals.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        Browse all deals
      </Link>
    </div>
  );
}

function DealPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(dealsQueryOptions);
  const deal = findDeal(data.deals, slug);
  const [alertDeal, setAlertDeal] = useState<Deal | null>(null);

  if (!deal) return <DealNotFound />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Back to all deals
      </Link>
      <div className="mt-4">
        <DealCard deal={deal} onAlert={setAlertDeal} />
      </div>
      {alertDeal && (
        <PriceAlertModal
          deal={alertDeal}
          open={!!alertDeal}
          onOpenChange={(o) => !o && setAlertDeal(null)}
        />
      )}
    </div>
  );
}