import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/disclaimer")({
  component: DisclaimerPage,
  head: () => ({
    meta: [
      { title: "Disclaimer — CheckThePrice" },
      {
        name: "description",
        content:
          "Prices, discounts, and availability shown on CheckThePrice may change at any time. Always verify on the retailer's site before purchasing.",
      },
      { property: "og:title", content: "Disclaimer — CheckThePrice" },
      {
        property: "og:description",
        content:
          "Prices, discounts, and availability may change at any time. Verify details on the retailer site before purchasing.",
      },
      { property: "og:url", content: "https://checktheprice.lovable.app/disclaimer" },
    ],
    links: [
      { rel: "canonical", href: "https://checktheprice.lovable.app/disclaimer" },
    ],
  }),
});

function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
        Disclaimer
      </h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          All deals, prices, discounts, coupon codes, and product availability
          listed on CheckThePrice are gathered from third-party retailers and
          publicly available sources. Prices and offers can change at any time
          without notice.
        </p>
        <h2 className="text-base font-bold text-foreground">No Guarantee</h2>
        <p>
          While we make every effort to ensure accuracy at the time of posting,
          we cannot guarantee that any price, discount, or stock level shown on
          this website will remain valid when you visit the retailer's page.
        </p>
        <h2 className="text-base font-bold text-foreground">Verify Before You Buy</h2>
        <p>
          Users are strongly advised to verify the final price, product
          specifications, warranty, shipping cost, and return policy on the
          retailer's official website before completing any purchase.
        </p>
        <h2 className="text-base font-bold text-foreground">Third-Party Sites</h2>
        <p>
          CheckThePrice links to third-party websites such as Amazon, Flipkart,
          and other retailers. We are not responsible for the content,
          policies, products, or services offered on those external sites.
        </p>
      </div>
    </main>
  );
}