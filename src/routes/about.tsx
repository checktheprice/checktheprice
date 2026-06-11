import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About Us — CheckThePrice" },
      {
        name: "description",
        content:
          "CheckThePrice curates the hottest online deals and compares them with offline market prices so you always grab the best loot.",
      },
      { property: "og:title", content: "About Us — CheckThePrice" },
      {
        property: "og:description",
        content:
          "CheckThePrice curates the hottest online deals and compares them with offline market prices.",
      },
    ],
  }),
});

function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
        About CheckThePrice
      </h1>
      <div className="mt-3 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          <strong>CheckThePrice</strong> helps users discover the latest online
          deals, discounts, and offers from trusted retailers including Amazon,
          Flipkart, and other leading e-commerce platforms in one clean,
          mobile-friendly place.
        </p>
        <p>
          Our editors hand-pick every deal, compare each online price with the
          typical offline market price, and surface only the offers that
          represent genuine savings — so you never have to wonder whether a
          "discount" is actually a discount.
        </p>
        <h2 className="pt-2 text-base font-bold text-foreground">What We Do</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Curate hot deals from trusted retailers, updated daily.</li>
          <li>Score every offer with our visual Loot Meter.</li>
          <li>Compare online prices vs typical local-shop prices.</li>
          <li>Push instant alerts via our WhatsApp channel.</li>
        </ul>
        <h2 className="pt-2 text-base font-bold text-foreground">Transparency</h2>
        <p>
          We participate in affiliate programs such as Amazon Associates and
          may earn a commission when you purchase via our links — at no extra
          cost to you. Read our{" "}
          <Link to="/affiliate-disclosure" className="text-primary hover:underline">
            Affiliate Disclosure
          </Link>{" "}
          for details.
        </p>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold">🔥 Loot Meter</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Visual scoring of every deal so you know what's truly hot.
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold">📉 Real Savings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare online prices vs estimated local-shop MRP.
          </p>
        </div>
      </div>
      <div className="mt-8">
        <Link
          to="/contact"
          className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          Contact Us
        </Link>
      </div>
    </main>
  );
}