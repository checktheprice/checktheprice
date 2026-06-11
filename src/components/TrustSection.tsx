import { ShieldCheck, BadgeCheck, RefreshCw, Tag } from "lucide-react";

const items = [
  {
    icon: BadgeCheck,
    title: "Hand-Picked Deals",
    desc: "Every offer is manually reviewed before it's published.",
  },
  {
    icon: RefreshCw,
    title: "Updated Daily",
    desc: "Fresh deals added throughout the day, every day.",
  },
  {
    icon: Tag,
    title: "Real Savings",
    desc: "We compare online prices vs typical offline market rates.",
  },
  {
    icon: ShieldCheck,
    title: "Transparent",
    desc: "Affiliate links are clearly disclosed. No hidden costs to you.",
  },
];

export function TrustSection() {
  return (
    <section
      aria-labelledby="trust-heading"
      className="mx-auto mt-10 max-w-7xl px-4"
    >
      <h2
        id="trust-heading"
        className="text-center text-2xl font-extrabold tracking-tight text-foreground"
      >
        Why Shoppers Trust CheckThePrice
      </h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div
            key={it.title}
            className="flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <it.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground">{it.title}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{it.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}