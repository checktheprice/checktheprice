/**
 * Shared Firecrawl product-page scraper.
 *
 * Used by both the Admin import workflow (/api/admin/fetch-details) and the
 * Compare Prices feature so that both paths use identical extraction logic.
 *
 * Server-only: imports the Firecrawl SDK and cheerio which must never reach
 * the client bundle.
 */
import Firecrawl from "@mendable/firecrawl-js";
import * as cheerio from "cheerio";
import { extractFlipkartProduct, flipkartStandardLink } from "./flipkart.server";
import { type Extracted, cleanText, parseInr } from "./types";

export type Merchant = "amazon" | "flipkart";

export type ScrapedProduct = {
  merchant: Merchant;
  standardLink: string;
  title: string;
  category: string | null;
  price: number;
  mrp: number;
  image: string;
};

// ---------------------------------------------------------------------------
// Amazon helpers — kept verbatim from the original fetch-details route so the
// extraction logic is identical to the Admin workflow.
// ---------------------------------------------------------------------------

function extractAsin(u: URL): string | null {
  const m =
    u.pathname.match(/\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i) ??
    u.pathname.match(/\/gp\/product\/([A-Z0-9]{10})(?:[/?]|$)/i) ??
    u.pathname.match(/\/gp\/aw\/d\/([A-Z0-9]{10})(?:[/?]|$)/i) ??
    u.pathname.match(/\/product\/([A-Z0-9]{10})(?:[/?]|$)/i);
  return m ? m[1].toUpperCase() : null;
}

function isCaptchaPage(html: string): boolean {
  return (
    /validateCaptcha/i.test(html) ||
    /Enter the characters you see below/i.test(html) ||
    /api-services-support@amazon\.com/i.test(html) ||
    /<title>\s*Robot Check\s*<\/title>/i.test(html)
  );
}

function extractAmazonProduct(html: string): Extracted {
  const $ = cheerio.load(html);

  const title = cleanText($("#productTitle").first().text());

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
      $("#priceblock_ourprice, #priceblock_dealprice").first().text(),
    );
  if (price === null) {
    price = parseInr(
      $("#centerCol .a-price:not(.a-text-price) .a-offscreen").first().text(),
    );
  }

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

  const imgEl = $("#landingImage, #imgBlkFront").first();
  let image =
    cleanText(imgEl.attr("data-old-hires")) ?? cleanText(imgEl.attr("src"));
  if (image && image.startsWith("data:")) {
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
// (mirrors the scrapeHtml + main loop in the original script.ts)
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
      `scrape failed after proxy fallback (CAPTCHA or fetch error): ${reason}`,
    );
  }

  return html;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Detect whether a URL is an Amazon.in or Flipkart.com product page. */
export function detectMerchantUrl(rawUrl: string): Merchant | null {
  let host: string;
  try {
    host = new URL(rawUrl.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host === "amazon.in" || host.endsWith(".amazon.in")) return "amazon";
  if (host === "flipkart.com" || host.endsWith(".flipkart.com")) return "flipkart";
  return null;
}

/** Build the canonical product URL from a pasted Amazon or Flipkart URL. */
export function canonicalLink(
  rawUrl: string,
): { merchant: Merchant; standardLink: string } | null {
  const merchant = detectMerchantUrl(rawUrl);
  if (!merchant) return null;

  let target: URL;
  try {
    target = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  if (merchant === "amazon") {
    const asin = extractAsin(target);
    if (!asin) return null;
    return { merchant, standardLink: `https://www.amazon.in/dp/${asin}` };
  }

  const fk = flipkartStandardLink(target);
  if (!fk) return null;
  return { merchant, standardLink: fk };
}

/**
 * Scrape an Amazon or Flipkart product URL via Firecrawl and extract
 * structured product data. Throws on unrecoverable failures.
 */
export async function scrapeProduct(rawUrl: string): Promise<ScrapedProduct> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is not configured on the server.");
  }

  const meta = canonicalLink(rawUrl);
  if (!meta) {
    throw new Error("Not a valid amazon.in or flipkart.com product URL.");
  }

  const firecrawl = new Firecrawl({ apiKey });
  const html = await scrapeWithFallback(firecrawl, meta.standardLink);

  const extracted =
    meta.merchant === "amazon"
      ? extractAmazonProduct(html)
      : extractFlipkartProduct(html);

  const missing: string[] = [];
  if (!extracted.title) missing.push("title");
  if (extracted.price === null) missing.push("price");
  if (!extracted.image) missing.push("image");
  if (missing.length > 0) {
    throw new Error(
      `Required product fields could not be extracted (${missing.join(", ")}).`,
    );
  }

  return {
    merchant: meta.merchant,
    standardLink: meta.standardLink,
    title: extracted.title!,
    category: extracted.category,
    price: extracted.price!,
    mrp: extracted.mrp ?? extracted.price!,
    image: extracted.image!,
  };
}
