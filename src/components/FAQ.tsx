import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "How do affiliate links work?",
    a: "When you click a deal and complete a purchase on the retailer's website, we may earn a small commission. The price you pay stays exactly the same.",
  },
  {
    q: "Are deals verified?",
    a: "We hand-pick and verify every deal at the time of posting. However, retailer prices and stock can change rapidly, so always confirm the final price on the retailer's site before buying.",
  },
  {
    q: "Why do prices change?",
    a: "Online prices change frequently due to flash sales, stock levels, and seller pricing rules. A deal may end or change within minutes of being posted.",
  },
  {
    q: "How often are deals updated?",
    a: "Deals are updated daily — often multiple times per day — to keep the latest offers at the top.",
  },
  {
    q: "Is there any extra cost to users?",
    a: "No. Using our affiliate links never costs you anything extra. It simply helps support CheckThePrice so we can keep curating great deals for free.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section
      id="faq"
      className="mx-auto mt-10 max-w-3xl px-4"
      aria-labelledby="faq-heading"
    >
      <h2
        id="faq-heading"
        className="text-center text-2xl font-extrabold tracking-tight text-foreground"
      >
        Frequently Asked Questions
      </h2>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        Everything you need to know about CheckThePrice deals.
      </p>
      <div className="mt-5 divide-y rounded-2xl border bg-white shadow-sm">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q}>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                aria-expanded={isOpen}
              >
                <h3 className="text-sm font-bold text-foreground">{f.q}</h3>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};