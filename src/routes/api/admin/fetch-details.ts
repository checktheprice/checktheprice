/**
 * POST /api/admin/fetch-details
 *
 * Server-side Amazon India product scraper using the Firecrawl SDK.
 * Ported directly from the Prometheus script.ts — helper functions are kept
 * verbatim so the extraction logic is identical to the exported collector.
 *
 * Reads FIRECRAWL_API_KEY from environment variables only.
 * The apiKey field sent by the browser is intentionally ignored so the key
 * is never required on the client and is never echoed back.
 *
 * Returns: { standard_link, title, category, price, mrp, image, updated }
 */
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import Firecrawl from "@mendable/firecrawl-js";
import * as cheerio from "cheerio";

// ---------------------------------------------------------------------------
// Helpers — copied verbatim from script.ts so extraction logic is identical.
// ---------------------------------------------------------------------------

function extractAsin(u: URL): string | null {
  const m =
    u.pathname.match(/\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i) ??
    u.pathname.match(/\/gp\/product\/([A-Z0-9]{10})(?:[/?]|$)/i) ??
    u.pathname.match(/\/gp\/aw\/d\/([A-Z0-9]{10})(?:[/?]|$)/i) ??
    u.pathname.match(/\/product\/([A-Z0-9]{10})(?:[/?]|$)/i);
  return m ? m[1].toUpperCase() : null;
}

function cleanText(s: string | undefined | null): string | null {
  if (!s) return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > 0 ? t : null;
}

// "₹52,400.00" / "52,400" -> 52400
function parseInr(s: string | undefined | null): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isCaptchaPage(html: string): boolean {
  return (
    /validateCaptcha/i.test(html) ||
    /Enter the characters you see below/i.test(html) ||
    /api-services-support@amazon\.com/i.test(html) ||
    /<title>\s*Robot Check\s*<\/title>/i.test(html)
  );
}

interface Extracted {
  title: string | null;
  category: string | null;
  price: number | null;
  mrp: number | null;
  image: string | null;
}

function extractProduct(html: string): Extracted {
  const $ = cheerio.load(html);

  const title = cleanText($("#productTitle").first().text());

  // Breadcrumb trail, e.g. "Electronics > Mobiles & Accessories > Smartphones";
  // fall back to the sub-nav category label when breadcrumbs are absent.
  const crumbs: string[] = [];
  $("#wayfinding-breadcrumbs_feature_div ul li a").each((_, el) => {
    const t = cleanText($(el).text());
    if (t) crumbs.push(t);
  });
  let category: string | null = crumbs.length > 0 ? crumbs.join(" > ") : null;
  if (!category) {
    category =
      cleanText($("#nav-subnav .nav-b").first().text()) ??
      cleanText($("#nav-subnav").attr("data-category"));
  }

  // Selling price: the buy-box price block first, then generic price nodes.
  let price =
    parseInr(
      $("#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen")
        .first()
        .text(),
    ) ??
    parseInr(
      $("#corePriceDisplay_desktop_feature_div .a-price-whole").first().text(),
    ) ??
    parseInr(
      $("#corePrice_feature_div .a-price .a-offscreen").first().text(),
    ) ??
    parseInr(
      $("#priceblock_ourprice, #priceblock_dealprice").first().text(),
    );
  if (price === null) {
    price = parseInr(
      $("#centerCol .a-price:not(.a-text-price) .a-offscreen").first().text(),
    );
  }

  // MRP: the struck-through list price shown next to a discount.
  const mrp =
    parseInr(
      $("#corePriceDisplay_desktop_feature_div .basisPrice .a-offscreen")
        .first()
        .text(),
    ) ??
    parseInr(
      $(
        '#centerCol .a-price.a-text-price[data-a-strike="true"] .a-offscreen',
      )
        .first()
        .text(),
    ) ??
    parseInr(
      $("#priceblock_listprice, .priceBlockStrikePriceString").first().text(),
    );

  // Main product image: prefer the hi-res variant when present.
  const imgEl = $("#landingImage, #imgBlkFront").first();
  let image =
    cleanText(imgEl.attr("data-old-hires")) ?? cleanText(imgEl.attr("src"));
  if (image && image.startsWith("data:")) {
    // Lazy-loaded placeholder — pull the largest candidate from the dynamic-image map.
    const dyn = imgEl.attr("data-a-dynamic-image");
    if (dyn) {
      try {
        const map = JSON.parse(dyn) as Record<string, unknown>;
        const urls = Object.keys(map);
        if (urls.length > 0) image = urls[0];
      } catch {
        image = null;
      }
    } else {
      image = null;
    }
  }

  return { title, category, price, mrp, image };
}

// ---------------------------------------------------------------------------
// Firecrawl scrape with CAPTCHA handling + proxy fallback
// (mirrors the scrapeHtml + main loop in script.ts)
// ---------------------------------------------------------------------------

async function scrapeWithFallback(
  firecrawl: Firecrawl,
  url: string,
): Promise<string> {
  let html = "";
  let lastError: unknown = null;

  for (const proxy of ["auto", "stealth"] as const) {
    try {
      const res = (await firecrawl.scrape(url, {
        formats: ["rawHtml"],
        proxy,
        integration: "prometheus",
      } as Parameters<typeof firecrawl.scrape>[1])) as {
        rawHtml?: string;
        html?: string;
      };
      html = res.rawHtml ?? res.html ?? "";
    } catch (err) {
      lastError = err;
      html = "";
      continue;
    }
    if (!html) {
      lastError = new Error("empty HTML response");
      continue;
    }
    if (isCaptchaPage(html)) {
      lastError = new Error("CAPTCHA page served");
      html = "";
      continue;
    }
    break;
  }

  if (!html) {
    const reason =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
      `amazon.in scrape failed after proxy fallback (CAPTCHA or fetch error): ${reason}`,
    );
  }

  return html;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/admin/fetch-details")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Read API key from server environment only — never from the request body.
        const apiKey = process.env.FIRECRAWL_API_KEY;
        if (!apiKey) {
          return jsonResponse(
            {
              error:
                "FIRECRAWL_API_KEY is not configured. Add it in the server environment variables.",
            },
            500,
          );
        }

        let body: { url?: unknown; apiKey?: unknown };
        try {
          body = (await request.json()) as { url?: unknown; apiKey?: unknown };
        } catch {
          return jsonResponse({ error: "Invalid JSON body." }, 400);
        }

        const rawUrl =
          typeof body.url === "string" ? body.url.trim() : "";
        if (!rawUrl) {
          return jsonResponse(
            { error: "url is required." },
            400,
          );
        }

        // --- URL validation + standard link (verbatim from script.ts) -------
        let target: URL;
        try {
          target = new URL(rawUrl);
        } catch {
          return jsonResponse(
            { error: `Not a valid URL: ${rawUrl}` },
            400,
          );
        }

        const host = target.hostname.toLowerCase();
        if (host !== "amazon.in" && !host.endsWith(".amazon.in")) {
          return jsonResponse(
            { error: `Not an amazon.in URL: ${rawUrl}` },
            400,
          );
        }

        const asin = extractAsin(target);
        if (!asin) {
          return jsonResponse(
            {
              error: `Not an amazon.in product page URL (no ASIN found in path): ${rawUrl}`,
            },
            400,
          );
        }

        const standardLink = `https://www.amazon.in/dp/${asin}`;

        // --- Firecrawl scrape ------------------------------------------------
        const firecrawl = new Firecrawl({ apiKey });
        let html: string;
        try {
          html = await scrapeWithFallback(firecrawl, standardLink);
        } catch (err) {
          return jsonResponse(
            {
              error:
                err instanceof Error
                  ? err.message
                  : "Firecrawl scrape failed.",
            },
            502,
          );
        }

        // --- Extract product fields (verbatim from script.ts) ----------------
        const p = extractProduct(html);

        const missing: string[] = [];
        if (!p.title) missing.push("title");
        if (p.price === null) missing.push("price");
        if (!p.image) missing.push("image");

        if (missing.length > 0) {
          return jsonResponse(
            {
              error: `Required product fields could not be extracted from the amazon.in page (${missing.join(", ")}). The page layout may have changed or the product may be unavailable.`,
            },
            422,
          );
        }

        // --- Response (identical fields to script.ts stdout) -----------------
        return jsonResponse({
          standard_link: standardLink,
          title: p.title,
          category: p.category,
          price: p.price,
          mrp: p.mrp ?? p.price,
          image: p.image,
          updated: new Date().toISOString(),
        });
      },
    },
  },
});
