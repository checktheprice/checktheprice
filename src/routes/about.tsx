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
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        CheckThePrice is a hand-curated deals platform that highlights the
        biggest online discounts and compares them with typical offline
        market prices, so you instantly see how much you save.
      </p>
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