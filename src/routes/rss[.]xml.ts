import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { fetchDeals, slugifyTitle } from "@/lib/deals";

const BASE_URL = "https://checktheprice.vercel.app";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatRfc2822(timestamp: number | undefined): string {
  const date = timestamp ? new Date(timestamp) : new Date();
  return date.toUTCString();
}

export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: {
      GET: async () => {
        const buildDate = formatRfc2822(undefined);

        let itemsXml = "";

        try {
          const { deals } = await fetchDeals();
          for (const deal of deals) {
            const slug = slugifyTitle(deal.title);
            if (!slug) continue;

            const link = `${BASE_URL}/deal/${slug}`;
            const pubDate = formatRfc2822(deal.addedAt);
            const discount =
              deal.mrp > 0
                ? Math.round(((deal.mrp - deal.onlinePrice) / deal.mrp) * 100)
                : 0;

            const description =
              `Save ${discount}% on ${deal.title} — now at ₹${deal.onlinePrice}` +
              (deal.mrp > deal.onlinePrice ? ` (MRP ₹${deal.mrp})` : "") +
              `. ${deal.category} deal available on ${deal.source || "our store"}.`;

            itemsXml +=
              `    <item>\n` +
              `      <title>${escapeXml(deal.title)}</title>\n` +
              `      <link>${escapeXml(link)}</link>\n` +
              `      <guid isPermaLink="true">${escapeXml(link)}</guid>\n` +
              `      <pubDate>${escapeXml(pubDate)}</pubDate>\n` +
              `      <description>${escapeXml(description)}</description>\n` +
              (deal.image
                ? `      <enclosure url="${escapeXml(deal.image)}" length="0" type="image/jpeg" />\n`
                : "") +
              `      <category>${escapeXml(deal.category)}</category>\n` +
              `    </item>\n`;
          }
        } catch {
          // If deal fetch fails, still serve the static RSS feed shell
        }

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
          "  <channel>",
          `    <title>${escapeXml("Checktheprice — Latest Deals")}</title>`,
          `    <link>${escapeXml(BASE_URL)}</link>`,
          `    <description>${escapeXml("Discover the best online deals, price drops, and offers updated daily.")}</description>`,
          `    <language>en</language>`,
          `    <lastBuildDate>${escapeXml(buildDate)}</lastBuildDate>`,
          `    <atom:link href="${escapeXml(`${BASE_URL}/rss.xml`)}" rel="self" type="application/rss+xml" />`,
          itemsXml,
          "  </channel>",
          "</rss>",
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
