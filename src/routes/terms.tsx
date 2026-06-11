import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms & Conditions — CheckThePrice" },
      {
        name: "description",
        content:
          "Terms of use, limitation of liability, and intellectual property notice for the CheckThePrice website.",
      },
      { property: "og:title", content: "Terms & Conditions — CheckThePrice" },
      {
        property: "og:description",
        content:
          "Terms of use, limitation of liability, and intellectual property notice for CheckThePrice.",
      },
      { property: "og:url", content: "https://checktheprice.lovable.app/terms" },
    ],
    links: [
      { rel: "canonical", href: "https://checktheprice.lovable.app/terms" },
    ],
  }),
});

function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
        Terms &amp; Conditions
      </h1>
      <div className="mt-4 space-y-5 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-base font-bold text-foreground">Website Usage</h2>
          <p>
            By accessing or using CheckThePrice, you agree to these Terms. The
            website is provided for personal, non-commercial use to help you
            discover online deals and offers. You agree not to misuse the
            site, attempt to scrape or overload our servers, or use it for any
            unlawful purpose.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-foreground">Limitation of Liability</h2>
          <p>
            CheckThePrice is provided "as is" without warranties of any kind.
            We are not liable for any direct, indirect, incidental, or
            consequential damages arising from your use of this website or
            from purchases made on third-party retailer sites linked from
            CheckThePrice.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-foreground">Accuracy of Information</h2>
          <p>
            We strive to keep prices, deals, and product information accurate,
            but we do not guarantee accuracy, completeness, or timeliness.
            Always verify the final price and product details on the
            retailer's official website before purchasing.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-foreground">Third-Party Links</h2>
          <p>
            Our website contains links to third-party retailers such as
            Amazon, Flipkart, and others. We have no control over the content,
            pricing, policies, or practices of these external sites and accept
            no responsibility for them. Your use of any third-party site is at
            your own risk and governed by that site's terms.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-foreground">Intellectual Property</h2>
          <p>
            The CheckThePrice name, logo, and original content are the
            property of CheckThePrice. Product images, brand names, and
            trademarks featured on the site belong to their respective owners
            and are used for identification and informational purposes only.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-foreground">Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. Continued use of the
            website after changes are posted constitutes acceptance of the
            updated Terms.
          </p>
        </section>
      </div>
    </main>
  );
}