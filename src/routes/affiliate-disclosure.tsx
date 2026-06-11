import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/affiliate-disclosure")({
  component: AffiliateDisclosurePage,
  head: () => ({
    meta: [
      { title: "Affiliate Disclosure — CheckThePrice" },
      {
        name: "description",
        content:
          "CheckThePrice participates in affiliate programs including Amazon Associates and may earn commissions from qualifying purchases at no extra cost to you.",
      },
      { property: "og:title", content: "Affiliate Disclosure — CheckThePrice" },
      {
        property: "og:description",
        content:
          "We participate in affiliate programs including Amazon Associates and may earn commissions from qualifying purchases.",
      },
      { property: "og:url", content: "https://checktheprice.lovable.app/affiliate-disclosure" },
    ],
    links: [
      { rel: "canonical", href: "https://checktheprice.lovable.app/affiliate-disclosure" },
    ],
  }),
});

function AffiliateDisclosurePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
        Affiliate Disclosure
      </h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          CheckThePrice is a participant in the Amazon Services LLC Associates
          Program and other affiliate networks. These are affiliate
          advertising programs designed to provide a means for sites to earn
          advertising fees by linking to retailer websites.
        </p>
        <h2 className="text-base font-bold text-foreground">How It Works</h2>
        <p>
          When you click on a deal or product link on our website and make a
          qualifying purchase on the retailer's site, we may earn a small
          commission. This commission comes at <strong>no additional cost to
          you</strong> — the price you pay is exactly the same.
        </p>
        <h2 className="text-base font-bold text-foreground">Our Promise</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>We only feature deals we believe offer genuine value.</li>
          <li>We never accept payment to promote a specific product.</li>
          <li>All affiliate relationships are transparently disclosed.</li>
          <li>
            Commissions help us keep CheckThePrice free for users and allow us
            to continue curating great deals.
          </li>
        </ul>
        <p>
          Thank you for supporting CheckThePrice by using our affiliate links.
        </p>
      </div>
    </main>
  );
}