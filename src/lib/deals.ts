export interface ProductContent {
  description: string;
  features: string[];
  benefits: string[];
  whoShouldBuy: string;
  buyingTips: string[];
  faqs: { q: string; a: string }[];
}

export interface Deal {
  id: string;
  title: string;
  category: string;
  image: string;
  onlinePrice: number;
  mrp: number;
  affiliateLink: string;
  source?: "Amazon" | "Flipkart" | "Other";
  couponCode?: string;
  hotDeal?: boolean;
  addedAt?: number;
  updatedAt?: number;
  aiContent?: ProductContent;
}

// 👉 REPLACE WITH YOUR GOOGLE SHEET ID
export const GOOGLE_SHEET_ID = "1OaATk_qm7XIRDbC9T59FIAapXmYNhY3fLVdLa94kAeY";
export const SHEET_NAME = "Sheet1";

const FALLBACK_DEALS: Deal[] = [];

function parseGviz(text: string): Deal[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Invalid Sheets response");
  const json = JSON.parse(text.slice(start, end + 1));
  const cols: string[] = json.table.cols.map((c: any) => String(c.label || c.id || "").trim().toLowerCase().replace(/[\s_-]/g, ""));
  return json.table.rows.map((row: any, i: number) => {
    const get = (...keys: string[]) => {
      for (const key of keys) {
        const idx = cols.indexOf(key.toLowerCase().replace(/[\s_-]/g, ""));
        if (idx === -1) continue;
        const cell = row.c?.[idx];
        const v = cell ? (cell.v ?? "") : "";
        if (v !== "" && v != null) return v;
      }
      return "";
    };
    const onlinePrice = Number(get("price", "onlineprice")) || 0;
    const mrp = Number(get("mrp")) || 0;
    const sourceRaw = String(get("source") || "").trim();
    const source = sourceRaw.toLowerCase() === "amazon" ? "Amazon" : sourceRaw.toLowerCase() === "flipkart" ? "Flipkart" : sourceRaw ? "Other" : undefined;
    const hot = String(get("hotdeal") || "").toLowerCase().trim();
    const updatedAt = parseSheetDate(get("updated", "updatedat", "lastupdated", "updateddate"));
    const affiliateLink = normalizeUrl(String(get("affiliatelink", "affiliate_link", "link", "url", "buylink", "producturl") || "").trim());
    return {
      id: String(i), title: String(get("title") || ""), category: String(get("category") || "General"), image: String(get("image") || ""),
      onlinePrice, mrp: mrp > 0 ? mrp : onlinePrice, affiliateLink: affiliateLink || "#", source,
      couponCode: String(get("couponcode") || "").trim() || undefined, hotDeal: hot === "true" || hot === "yes" || hot === "1",
      addedAt: Date.now() - i * 60_000, updatedAt,
    };
  }).filter((d: Deal) => d.title && d.mrp > 0 && d.onlinePrice > 0);
}

function parseSheetDate(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "string") {
    const m = v.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/);
    if (m) return new Date(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0)).getTime();
    const t = Date.parse(v); if (!Number.isNaN(t)) return t;
  }
  if (typeof v === "number") return v > 20000 && v < 80000 ? Math.round((v - 25569) * 86400 * 1000) : v;
  return undefined;
}

export function normalizeUrl(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^\/\//.test(trimmed)) return "https:" + trimmed;
  if (!/\./.test(trimmed)) return "";
  return "https://" + trimmed.replace(/^\/+/, "");
}

export function isValidAffiliateLink(url: string | undefined | null): boolean {
  if (!url || url === "#") return false;
  try { const u = new URL(url); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
}

export interface FetchDebugInfo { url: string; status: number | null; error: string | null; sheetName: string; sheetId: string; rowCount: number; timestamp: string; }

export async function fetchDeals(): Promise<{ deals: Deal[]; debug: FetchDebugInfo }> {
  const debug: FetchDebugInfo = { url: "", status: null, error: null, sheetName: SHEET_NAME, sheetId: GOOGLE_SHEET_ID, rowCount: 0, timestamp: new Date().toISOString() };
  if (!GOOGLE_SHEET_ID || GOOGLE_SHEET_ID.startsWith("YOUR_")) { debug.error = "No valid GOOGLE_SHEET_ID configured."; return { deals: FALLBACK_DEALS, debug }; }
  const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}&_cb=${Date.now()}`;
  debug.url = url;
  try {
    const res = await fetch(url, { cache: "no-store", redirect: "follow" });
    debug.status = res.status;
    if (!res.ok) { debug.error = `Sheet HTTP ${res.status}`; return { deals: FALLBACK_DEALS, debug }; }
    const deals = parseGviz(await res.text());
    debug.rowCount = deals.length;
    if (!deals.length) { debug.error = "Sheet parsed but returned zero valid rows."; return { deals: FALLBACK_DEALS, debug }; }
    return { deals: deals.map((d) => d.image ? d : { ...d, image: PLACEHOLDER_IMG }), debug };
  } catch (e) {
    debug.error = String(e);
    return { deals: FALLBACK_DEALS, debug };
  }
}

const PLACEHOLDER_IMG = "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80";
export function calcDiscount(mrp: number, online: number): number { if (mrp <= 0) return 0; return Math.round(((mrp - online) / mrp) * 100); }
export function localShopPrice(mrp: number): number { return Math.round(mrp * 0.95); }
export type LootLevel = "hot" | "mid" | "low";
export function lootLevel(discount: number): LootLevel { if (discount > 65) return "hot"; if (discount >= 40) return "mid"; return "low"; }
export function slugifyTitle(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80); }
