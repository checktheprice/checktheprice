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
import { normalizeCategory } from "@/lib/categories";
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

/**
 * Prefer a clear product-type signal from the title over a broad marketplace
 * breadcrumb. This fixes cases such as "Vegetable Peeler" being placed in
 * Amazon's broad "Home & Furniture" category.
 *
 * The keyword rules are deliberately conservative: when the title does not
 * clearly identify a category, the existing scraped category is retained.
 */
function classifyProductCategory(title: string, scrapedCategory: string | null): string {
  const text = title.toLowerCase().replace(/[^a-z0-9&' -]+/g, " ").replace(/\s+/g, " ").trim();

  const titleRules: Array<{ category: string; patterns: RegExp[] }> = [
    {
      category: "Kitchen",
      patterns: [
        /\bvegetable\s+peeler\b/, /\bpotato\s+peeler\b/, /\bpeeler\b/,
        /\bchopper\b/, /\bgrater\b/, /\bmandoline\b/, /\bcolander\b/,
        /\bstrainer\b/, /\bspatula\b/, /\btongs?\b/, /\bknife\b/,
        /\bknives\b/, /\bcutlery\b/, /\brolling\s+pin\b/, /\bchopping\s+board\b/,
        /\bcutting\s+board\b/, /\bvegetable\s+cutter\b/, /\bgarlic\s+press\b/,
        /\bmasher\b/, /\bwhisk\b/, /\bkitchen\b/, /\bcookware\b/,
        /\bpressure\s+cooker\b/, /\bair\s+fryer\b/, /\bmixer\s+grinder\b/,
        /\belectric\s+kettle\b/, /\bdinner\s+set\b/, /\blunch\s+box\b/,
      ],
    },
    {
      category: "Beauty",
      patterns: [
        /\btoothpaste\b/, /\btoothbrush\b/, /\bmouthwash\b/, /\bdental\s+floss\b/,
        /\bshampoo\b/, /\bconditioner\b/, /\bface\s+wash\b/, /\bfacewash\b/,
        /\bmoisturizer\b/, /\bmoisturiser\b/, /\bsunscreen\b/, /\bserum\b/,
        /\bdeodorant\b/, /\bperfume\b/, /\bbody\s+wash\b/, /\bsoap\b/,
        /\bface\s+cream\b/, /\bhair\s+oil\b/, /\bhair\s+dryer\b/, /\btrimmer\b/,
        /\bshaver\b/, /\brazor\b/, /\bmakeup\b/, /\bcosmetic\b/, /\bskincare\b/,
      ],
    },
    {
      category: "Fashion",
      patterns: [
        /\brakhi\b/, /\bsaree\b/, /\bsari\b/, /\bkurta\b/, /\bkurti\b/,
        /\bdress\b/, /\bshirt\b/, /\bt-?shirt\b/, /\bjeans\b/, /\btrousers\b/,
        /\bshoes?\b/, /\bsneakers?\b/, /\bsandals?\b/, /\bhandbag\b/,
        /\bbackpack\b/, /\bwallet\b/, /\bbelt\b/, /\bsunglasses\b/,
      ],
    },
    {
      category: "Home & Furniture",
      patterns: [
        /\bbean\s*bag\b/, /\bsofa\b/, /\bchair\b/, /\btable\b/, /\bbed\b/,
        /\bmattress\b/, /\bpillow\b/, /\bcushion\b/, /\bbedsheet\b/,
        /\bcurtain\b/, /\bcarpet\b/, /\brug\b/, /\bmandir\b/, /\bpooja\s+mandir\b/,
        /\bwall\s+decor\b/, /\bhome\s+decor\b/, /\bwall\s+clock\b/,
      ],
    },
    {
      category: "Electronics",
      patterns: [
        /\bsmartphone\b/, /\bmobile\s+phone\b/, /\btablet\b/, /\btelevision\b/, /\bsmart\s+tv\b/,
        /\bheadphones?\b/, /\bearbuds?\b/, /\bearphones?\b/, /\bspeaker\b/, /\bsoundbar\b/,
        /\bpower\s+bank\b/, /\bcharger\b/, /\bcamera\b/, /\bgaming\s+console\b/,
      ],
    },
    {
      category: "Home Appliances",
      patterns: [
        /\brefrigerator\b/, /\bfridge\b/, /\bwashing\s+machine\b/, /\bair\s+conditioner\b/,
        /\bair\s+cooler\b/, /\bair\s+purifier\b/, /\bvacuum\s+cleaner\b/, /\bgeyser\b/,
      ],
    },
  ];

  for (const rule of titleRules) {
    if (rule.patterns.some((pattern) => pattern.test(text))) return rule.category;
  }

  return scrapedCategory ? normalizeCategory(scrapedCategory) : null;
}

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
    parseInr($("#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen").first().text()) ??
    parseInr($("#corePriceDisplay_desktop_feature_div .a-price-whole").first().text()) ??
    parseInr($("#priceblock_ourprice, #priceblock_dealprice").first().text());
  if (price === null) {
    price = parseInr($("#centerCol .a-price:not(.a-text-price) .a-offscreen").first().text());
  }

  const mrp =
    parseInr($("#corePriceDisplay_desktop_feature_div .basisPrice .a-offscreen").first().text()) ??
    parseInr($('#centerCol .a-price.a-text-price[data-a-strike="true"] .a-offscreen').first().text()) ??
    parseInr($("#priceblock_listprice, .priceBlockStrikePriceString").first().text());

  const imgEl = $("#landingImage, #imgBlkFront").first();
  let image = cleanText(imgEl.attr("data-old-hires")) ?? cleanText(imgEl.attr("src"));
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
    } else image = null;
  }

  return { title, category, price, mrp, image };
}

async function scrapeWithFallback(
  firecrawl: Firecrawl,
  url: string,
  extract: (html: string) => Extracted,
): Promise<{ html: string; extracted: Extracted }> {
  let lastError: unknown = null;

  for (const proxy of ["auto", "stealth"] as const) {
    let html = "";
    let retryReason = "";
    try {
      const res = (await firecrawl.scrape(url, {
        formats: ["rawHtml"],
        proxy,
        integration: "prometheus",
      } as Parameters<typeof firecrawl.scrape>[1])) as {
        rawHtml?: string; html?: string; status?: string; success?: boolean;
      };
      html = res.rawHtml ?? res.html ?? "";
      console.log(`[firecrawl] proxy=${proxy} status=${res.status ?? (res.success === true ? "success" : res.success === false ? "failed" : "unknown")} htmlLength=${html.length}`);
    } catch (err) {
      retryReason = `exception: ${(err as Error).message}`;
      console.log(`[firecrawl] proxy=${proxy} retry reason: ${retryReason}`);
      lastError = err;
      continue;
    }
    if (!html) { retryReason = "empty HTML response"; lastError = new Error(retryReason); continue; }
    if (isCaptchaPage(html)) { retryReason = "CAPTCHA page served"; lastError = new Error(retryReason); continue; }
    const extracted = extract(html);
    const missing: string[] = [];
    if (!extracted.title) missing.push("title");
    if (extracted.price === null) missing.push("price");
    if (!extracted.image) missing.push("image");
    if (missing.length > 0) { retryReason = `unusable data (missing: ${missing.join(", ")})`; lastError = new Error(retryReason); continue; }
    return { html, extracted };
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`scrape failed after proxy fallback (CAPTCHA or fetch error): ${reason}`);
}

export function detectMerchantUrl(rawUrl: string): Merchant | null {
  let host: string;
  try { host = new URL(rawUrl.trim()).hostname.toLowerCase(); } catch { return null; }
  if (host === "amazon.in" || host.endsWith(".amazon.in")) return "amazon";
  if (host === "flipkart.com" || host.endsWith(".flipkart.com")) return "flipkart";
  return null;
}

export function canonicalLink(rawUrl: string): { merchant: Merchant; standardLink: string } | null {
  const merchant = detectMerchantUrl(rawUrl);
  if (!merchant) return null;
  let target: URL;
  try { target = new URL(rawUrl.trim()); } catch { return null; }
  if (merchant === "amazon") {
    const asin = extractAsin(target);
    if (!asin) return null;
    return { merchant, standardLink: `https://www.amazon.in/dp/${asin}` };
  }
  const fk = flipkartStandardLink(target);
  if (!fk) return null;
  return { merchant, standardLink: fk };
}

export async function scrapeProduct(rawUrl: string): Promise<ScrapedProduct> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not configured on the server.");
  const meta = canonicalLink(rawUrl);
  if (!meta) throw new Error("Not a valid amazon.in or flipkart.com product URL.");
  const extract = meta.merchant === "amazon" ? extractAmazonProduct : extractFlipkartProduct;
  const firecrawl = new Firecrawl({ apiKey });
  const { extracted } = await scrapeWithFallback(firecrawl, meta.standardLink, extract);

  return {
    merchant: meta.merchant,
    standardLink: meta.standardLink,
    title: extracted.title!,
    category: classifyProductCategory(extracted.title!, extracted.category),
    price: extracted.price!,
    mrp: extracted.mrp ?? extracted.price!,
    image: extracted.image!,
  };
}
