import { createFileRoute, Link, useRouter, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { DealCard } from "@/components/DealCard";
import { PriceAlertModal } from "@/components/PriceAlertModal";
import { useEffect, useMemo, useState } from "react";
import { fetchDeals, slugifyTitle, type Deal, calcDiscount } from "@/lib/deals";
import {
  generateSeoContent,
  getSeoContent,
  formatUpdatedAgo,
} from "@/lib/seo-content";

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
    const discountPct =
      deal.mrp > 0
        ? Math.round(((deal.mrp - deal.onlinePrice) / deal.mrp) * 100)
        : 0;
    // Deterministic — same title always yields same content.
    const seo = generateSeoContent(deal.title, deal.category, discountPct);
    return {
      slug: params.slug,
      title: deal.title,
      metaDescription: seo.metaDescription,
      image: deal.image,
    };
  },
  head: ({ params, loaderData }) => {
    const url = `https://checktheprice.vercel.app/deal/${params.slug}`;
    const title = loaderData?.title
      ? `${loaderData.title} — Deal on CheckThePrice`
      : "Deal — CheckThePrice";
    const desc =
      loaderData?.metaDescription ??
      "View this hand-picked deal on CheckThePrice.";
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "product" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: desc },
    ];
    if (loaderData?.image) {
      meta.push({ property: "og:image", content: loaderData.image });
      meta.push({ name: "twitter:image", content: loaderData.image });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
    };
  },
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
  const [updatedLabel, setUpdatedLabel] = useState<string>("Recently updated");

  useEffect(() => {
    if (!deal) return;
    setUpdatedLabel(formatUpdatedAgo(deal.addedAt));
    const id = window.setInterval(
      () => setUpdatedLabel(formatUpdatedAgo(deal.addedAt)),
      60_000,
    );
    return () => window.clearInterval(id);
  }, [deal]);

  const discountPct = deal ? calcDiscount(deal.mrp, deal.onlinePrice) : 0;
  const seo = useMemo(
    () =>
      deal
        ? getSeoContent(deal.title, deal.category, discountPct)
        : null,
    [deal, discountPct],
  );

  if (!deal || !seo) return <DealNotFound />;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: deal.title,
    image: deal.image ? [deal.image] : undefined,
    description: seo.metaDescription,
    category: deal.category,
    brand: deal.source ? { "@type": "Brand", name: deal.source } : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: deal.onlinePrice,
      url: `https://checktheprice.vercel.app/deal/${slug}`,
      availability: "https://schema.org/InStock",
    },
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: seo.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Back to all deals
      </Link>

      {/* H1 — primary heading for the deal page */}
      <h1 className="mt-3 text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">
        {deal.title}
      </h1>
      <div className="mt-1 text-xs text-muted-foreground">
        <span>{updatedLabel}</span>
        <span className="mx-1.5">·</span>
        <span>{deal.category}</span>
        {deal.source && (
          <>
            <span className="mx-1.5">·</span>
            <span>{deal.source}</span>
          </>
        )}
      </div>

      <div className="mt-4">
        <DealCard deal={deal} onAlert={setAlertDeal} />
      </div>

      {/* SEO content */}
      <article className="mt-8 space-y-8 text-[15px] leading-relaxed text-foreground">
        <section aria-labelledby="about-heading">
          <h2
            id="about-heading"
            className="text-lg font-bold tracking-tight text-foreground"
          >
            About the {deal.title}
          </h2>
          <p className="mt-2 text-muted-foreground">{seo.description}</p>
        </section>

        <section aria-labelledby="features-heading">
          <h2
            id="features-heading"
            className="text-lg font-bold tracking-tight text-foreground"
          >
            Key features
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {seo.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="benefits-heading">
          <h2
            id="benefits-heading"
            className="text-lg font-bold tracking-tight text-foreground"
          >
            Main benefits
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {seo.benefits.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="who-heading">
          <h2
            id="who-heading"
            className="text-lg font-bold tracking-tight text-foreground"
          >
            Who should buy this?
          </h2>
          <p className="mt-2 text-muted-foreground">{seo.whoShouldBuy}</p>
        </section>

        <section aria-labelledby="tips-heading">
          <h2
            id="tips-heading"
            className="text-lg font-bold tracking-tight text-foreground"
          >
            Buying tips
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {seo.buyingTips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="faq-heading">
          <h2
            id="faq-heading"
            className="text-lg font-bold tracking-tight text-foreground"
          >
            Frequently asked questions
          </h2>
          <div className="mt-3 divide-y rounded-xl border bg-white">
            {seo.faqs.map((f) => (
              <details key={f.q} className="group px-4 py-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
                  {f.q}
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </article>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

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
