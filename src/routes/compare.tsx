import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  ComparePricesSection,
  COMPARE_SUBTITLE,
  COMPARE_TITLE,
} from "@/components/ComparePricesSection";

const TITLE = "Check the Price Before You Buy | CheckThePrice";
const DESC = COMPARE_SUBTITLE;

export const Route = createFileRoute("/compare")({
  component: ComparePage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: COMPARE_TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ComparePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <ComparePricesSection headingLevel="h1" />
      <Footer />
    </div>
  );
}
