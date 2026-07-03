import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { fetchDeals, slugifyTitle } from "@/lib/deals";

const BASE_URL = "https://checktheprice.vercel.app";

interface SitemapEntry {
  path: string;
  priority: string;
  changefreq: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", priority: "1.0", changefreq: "daily" },
          { path: "/about", priority: "0.7", changefreq: "monthly" },
          { path: "/contact", priority: "0.6", changefreq: "monthly" },
          { path: "/disclaimer", priority: "0.4", changefreq: "yearly" },
          { path: "/affiliate-disclosure", priority: "0.5", changefreq: "yearly" },
          { path: "/privacy", priority: "0.5", changefreq: "yearly" },
          { path: "/terms", priority: "0.5", changefreq: "yearly" },
        ];

        try {
          const { deals } = await fetchDeals();
          for (const deal of deals) {
            const slug = slugifyTitle(deal.title);
            if (slug) {
              entries.push({
                path: `/deal/${slug}`,
                priority: "0.6",
                changefreq: "daily",
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
              `  <url>\n    <loc>${escapeXml(`${BASE_URL}${e.path}`)}</loc>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
          )
          .join("\n");

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">',
          urls,
          "</urlset>",
        ].join("\n");
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
