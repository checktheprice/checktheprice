import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { fetchDeals, slugifyTitle } from "@/lib/deals";

const BASE_URL = "https://checktheprice.vercel.app";

interface SitemapEntry {
  path: string;
  priority: string;
  changefreq: string;
  lastmod: string;
}

// Real last-modified dates for static pages. Update when the page content changes.
const STATIC_PAGES: SitemapEntry[] = [
  { path: "/", priority: "1.0", changefreq: "daily", lastmod: "2025-06-20" },
  { path: "/about", priority: "0.7", changefreq: "monthly", lastmod: "2025-04-15" },
  { path: "/contact", priority: "0.6", changefreq: "monthly", lastmod: "2025-04-15" },
  { path: "/disclaimer", priority: "0.4", changefreq: "yearly", lastmod: "2025-02-10" },
  { path: "/affiliate-disclosure", priority: "0.5", changefreq: "yearly", lastmod: "2025-02-10" },
  { path: "/privacy", priority: "0.5", changefreq: "yearly", lastmod: "2025-02-10" },
  { path: "/terms", priority: "0.5", changefreq: "yearly", lastmod: "2025-02-10" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const today = new Date().toISOString().split("T")[0];
        const entries: SitemapEntry[] = [...STATIC_PAGES];

        try {
          const { deals } = await fetchDeals();
          for (const deal of deals) {
            const slug = slugifyTitle(deal.title);
            if (slug) {
              const lastmod = deal.updatedAt
                ? new Date(deal.updatedAt).toISOString().split("T")[0]
                : today;
              entries.push({
                path: `/deal/${slug}`,
                priority: "0.6",
                changefreq: "daily",
                lastmod,
              });
            }
          }
        } catch {
          // If deal fetch fails, still serve the static sitemap
        }

        const escapeXml = (str: string) =>
          str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");

        const urls = entries
          .map(
            (e) =>
              `  <url>\n    <loc>${escapeXml(`${BASE_URL}${e.path}`)}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
          )
          .join("\n");

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          urls,
          "</urlset>",
        ].join("\n");
        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      },
    },
  },
});
