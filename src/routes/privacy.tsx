import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — CheckThePrice" },
      {
        name: "description",
        content:
          "Read how CheckThePrice handles cookies, analytics, advertising, affiliate tracking, and user privacy.",
      },
      { property: "og:title", content: "Privacy Policy — CheckThePrice" },
      {
        property: "og:description",
        content:
          "How CheckThePrice handles cookies, analytics, advertising, affiliate tracking, and user privacy.",
      },
      { property: "og:url", content: "https://checktheprice.lovable.app/privacy" },
    ],
    links: [
      { rel: "canonical", href: "https://checktheprice.lovable.app/privacy" },
    ],
  }),
});

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
        Privacy Policy
      </h1>
      <div className="mt-4 space-y-5 text-sm leading-relaxed text-muted-foreground">
        <p>
          This Privacy Policy explains how CheckThePrice ("we", "us", "our")
          collects, uses, and protects information when you use our website.
        </p>

        <section>
          <h2 className="text-base font-bold text-foreground">Cookies</h2>
          <p>
            We use cookies and similar technologies to remember preferences,
            understand how visitors use the site, and improve your experience.
            You can disable cookies in your browser settings, though some
            features may not work correctly.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-foreground">Analytics</h2>
          <p>
            We may use third-party analytics services (such as Google
            Analytics) to understand aggregate site usage. These services may
            collect anonymous information such as pages visited, browser type,
            device, and approximate location.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-foreground">Advertising</h2>
          <p>
            We may display advertising from third-party ad networks including
            Google AdSense. These networks may use cookies to serve ads based
            on your previous visits to this and other websites. You can opt
            out of personalized advertising via Google's{" "}
            <a
              href="https://www.google.com/settings/ads"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Ads Settings
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-foreground">Affiliate Tracking</h2>
          <p>
            Outbound links to retailers may include affiliate tracking
            parameters that allow the retailer to attribute a purchase to
            CheckThePrice. This does not change the price you pay. See our{" "}
            <a href="/affiliate-disclosure" className="text-primary hover:underline">
              Affiliate Disclosure
            </a>{" "}
            for details.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-foreground">User Privacy Protection</h2>
          <p>
            We do not sell your personal information. We do not require you to
            create an account to browse deals. Any information you voluntarily
            provide (e.g. via the contact email) is used only to respond to
            your enquiry.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-foreground">Children's Privacy</h2>
          <p>
            CheckThePrice is not directed to children under 13. We do not
            knowingly collect personal information from children.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-foreground">Contact</h2>
          <p>
            Questions about this policy? Email us at{" "}
            <a
              href="mailto:support.editexa@gmail.com"
              className="text-primary hover:underline"
            >
              support.editexa@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}