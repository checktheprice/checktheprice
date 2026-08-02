/**
 * Flipkart product extraction — ported verbatim from the exported Prometheus
 * collector (script.ts) so the extraction logic is identical.
 */
import * as cheerio from "cheerio";
import { type Extracted, cleanText, parseInr } from "./types";

export function extractFlipkartProduct(html: string): Extracted {
  const $ = cheerio.load(html);

  // Some Flipkart page variants embed a schema.org Product JSON-LD block —
  // authoritative for title/price/image/category when present.
  let ldTitle: string | null = null;
  let ldPrice: number | null = null;
  let ldImage: string | null = null;
  let ldCategory: string | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).contents().text().trim();
    if (!text) return;
    try {
      const parsed = JSON.parse(text) as unknown;
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const o = node as Record<string, unknown>;
        if (o["@type"] !== "Product" && !(o.name && o.offers)) continue;
        ldTitle = ldTitle ?? cleanText(typeof o.name === "string" ? o.name : null);
        ldCategory =
          ldCategory ?? cleanText(typeof o.category === "string" ? o.category : null);
        const img = o.image;
        if (!ldImage) {
          if (typeof img === "string") ldImage = cleanText(img);
          else if (Array.isArray(img) && typeof img[0] === "string")
            ldImage = cleanText(img[0]);
        }
        const offers = o.offers;
        if (ldPrice === null && offers && typeof offers === "object") {
          const p = (offers as Record<string, unknown>).price;
          if (typeof p === "number" && Number.isFinite(p) && p > 0) ldPrice = p;
          else if (typeof p === "string") ldPrice = parseInr(p);
        }
      }
    } catch {
      /* ignore malformed JSON-LD blocks */
    }
  });

  const title: string | null = ldTitle ?? cleanText($("h1").first().text());

  // Breadcrumbs: category links that appear BEFORE the product <h1>.
  const crumbs: string[] = [];
  $('a[href*="/pr?sid="], h1').each((_, el) => {
    if (el.tagName?.toLowerCase() === "h1") return false;
    const t = cleanText($(el).text());
    if (t) crumbs.push(t);
    return true;
  });
  const category: string | null = crumbs.length > 0 ? crumbs.join(" > ") : ldCategory;

  // Flipkart class names are randomized hashes, so anchor on the buy-box
  // structure: the struck-through MRP precedes the pay price ("₹<amount>").
  const leaves = $("body *")
    .toArray()
    .filter((el) => $(el).children().length === 0);
  const leafText = (i: number) => $(leaves[i]).text().trim();
  const leafStruck = (i: number) =>
    (leaves[i].attribs?.style ?? "").includes("line-through");

  let domPrice: number | null = null;
  let domPriceIdx = -1;
  for (let i = 0; i < leaves.length; i++) {
    if (!leafStruck(i) && /^₹[0-9][0-9,]*$/.test(leafText(i))) {
      domPrice = parseInr(leafText(i));
      domPriceIdx = i;
      break;
    }
  }

  const price = ldPrice ?? domPrice;

  let priceIdx = domPriceIdx;
  if (price !== null && (domPrice === null || domPrice !== price)) {
    priceIdx = -1;
    for (let i = 0; i < leaves.length; i++) {
      if (
        !leafStruck(i) &&
        /^₹[0-9][0-9,]*$/.test(leafText(i)) &&
        parseInr(leafText(i)) === price
      ) {
        priceIdx = i;
        break;
      }
    }
  }

  // MRP: struck price within a short window before the pay price.
  let mrp: number | null = null;
  if (price !== null && priceIdx !== -1) {
    for (let i = priceIdx - 1; i >= Math.max(0, priceIdx - 15); i--) {
      if (leafStruck(i)) {
        const v = parseInr(leafText(i));
        if (v !== null && v >= price) mrp = v;
        break;
      }
    }
  }

  const image =
    ldImage ?? cleanText($('meta[property="og:image"]').first().attr("content"));

  return { title, category, price, mrp, image };
}

/** Flipkart product pages live at /<slug>/p/<itemId>, optionally with ?pid=. */
export function flipkartStandardLink(target: URL): string | null {
  if (!/\/p\/itm[a-z0-9]+/i.test(target.pathname)) return null;
  const pid = target.searchParams.get("pid");
  return (
    `https://www.flipkart.com${target.pathname}` +
    (pid ? `?pid=${encodeURIComponent(pid)}` : "")
  );
}
