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
  addedAt?: number; // timestamp for sorting "Price Drops"
}

// 👉 REPLACE WITH YOUR GOOGLE SHEET ID
// 1. Open your Google Sheet
// 2. Click Share → "Anyone with the link" → Viewer
// 3. Copy the ID from the URL: docs.google.com/spreadsheets/d/<THIS_ID>/edit
// Required columns (row 1 = headers):
// Title | Category | Image | OnlinePrice | MRP | AffiliateLink | Source | CouponCode | HotDeal
export const GOOGLE_SHEET_ID = "1OaATk_qm7XIRDbC9T59FIAapXmYNhY3fLVdLa94kAeY";
export const SHEET_NAME = "Sheet1";

const FALLBACK_DEALS: Deal[] = [
  {
    id: "demo-1",
    title: "Wireless Noise-Cancelling Headphones",
    category: "Electronics",
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
    onlinePrice: 2499,
    mrp: 8999,
    affiliateLink: "#",
    source: "Amazon",
    couponCode: "SOUND200",
    hotDeal: true,
    addedAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: "demo-2",
    title: "Smart Fitness Watch Series 7",
    category: "Wearables",
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80",
    onlinePrice: 3299,
    mrp: 5999,
    affiliateLink: "#",
    source: "Flipkart",
    hotDeal: false,
    addedAt: Date.now() - 1000 * 60 * 60 * 10,
  },
  {
    id: "demo-3",
    title: "Premium Cotton T-Shirt Pack",
    category: "Fashion",
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80",
    onlinePrice: 899,
    mrp: 1499,
    affiliateLink: "#",
    source: "Flipkart",
    couponCode: "STYLE100",
    addedAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: "demo-4",
    title: "Stainless Steel Cookware Set",
    category: "Home",
    image:
      "https://images.unsplash.com/photo-1584990347449-a5d9f8d1f5d8?w=800&q=80",
    onlinePrice: 1799,
    mrp: 4999,
    affiliateLink: "#",
    source: "Amazon",
    hotDeal: true,
    addedAt: Date.now() - 1000 * 60 * 30,
  },
  {
    id: "demo-5",
    title: "Portable Bluetooth Speaker — Bass Boost",
    category: "Electronics",
    image:
      "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&q=80",
    onlinePrice: 799,
    mrp: 2999,
    affiliateLink: "#",
    source: "Amazon",
    couponCode: "BASS50",
    hotDeal: true,
    addedAt: Date.now() - 1000 * 60 * 90,
  },
  {
    id: "demo-6",
    title: "Running Shoes — Lightweight Mesh",
    category: "Fashion",
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
    onlinePrice: 1299,
    mrp: 3499,
    affiliateLink: "#",
    source: "Flipkart",
    addedAt: Date.now() - 1000 * 60 * 60 * 5,
  },
  {
    id: "demo-7",
    title: "Stainless Vacuum Water Bottle 1L",
    category: "Home",
    image:
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80",
    onlinePrice: 349,
    mrp: 999,
    affiliateLink: "#",
    source: "Amazon",
    couponCode: "HYDRATE",
    addedAt: Date.now() - 1000 * 60 * 60 * 8,
  },
  {
    id: "demo-8",
    title: "True Wireless Earbuds — 30h Playback",
    category: "Electronics",
    image:
      "https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=800&q=80",
    onlinePrice: 1499,
    mrp: 4999,
    affiliateLink: "#",
    source: "Flipkart",
    hotDeal: true,
    addedAt: Date.now() - 1000 * 60 * 15,
  },
];

function parseGviz(text: string): Deal[] {
  // gviz wraps JSON in: /*O_o*/\ngoogle.visualization.Query.setResponse({...});
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Invalid Sheets response");
  const json = JSON.parse(text.slice(start, end + 1));
  const cols: string[] = json.table.cols.map((c: any) =>
    String(c.label || c.id || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]/g, ""),
  );
  return json.table.rows
    .map((row: any, i: number) => {
      const get = (...keys: string[]) => {
        for (const key of keys) {
          const idx = cols.indexOf(
            key.toLowerCase().replace(/[\s_-]/g, ""),
          );
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
      const source =
        sourceRaw.toLowerCase() === "amazon"
          ? "Amazon"
          : sourceRaw.toLowerCase() === "flipkart"
            ? "Flipkart"
            : sourceRaw
              ? "Other"
              : undefined;
      const hot = String(get("hotdeal") || "")
        .toLowerCase()
        .trim();
      return {
        id: String(i),
        title: String(get("title") || ""),
        category: String(get("category") || "General"),
        image: String(get("image") || ""),
        onlinePrice,
        mrp: mrp > 0 ? mrp : onlinePrice, // fallback so card still renders
        affiliateLink: String(get("affiliatelink", "affiliate_link", "link", "url") || "#"),
        source,
        couponCode: String(get("couponcode") || "").trim() || undefined,
        hotDeal: hot === "true" || hot === "yes" || hot === "1",
        addedAt: Date.now() - i * 60_000,
      };
    })
    .filter((d: Deal) => d.title && d.mrp > 0 && d.onlinePrice > 0);
}

export async function fetchDeals(): Promise<Deal[]> {
  if (!GOOGLE_SHEET_ID || (GOOGLE_SHEET_ID as string).startsWith("YOUR_")) {
    return FALLBACK_DEALS;
  }
  const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch sheet");
  const text = await res.text();
  const deals = parseGviz(text);
  if (!deals.length) return FALLBACK_DEALS;
  // Auto-resolve missing images from the affiliate link via Microlink (no key, free tier).
  const enriched = await Promise.all(
    deals.map(async (d) => {
      if (d.image || !d.affiliateLink || d.affiliateLink === "#") return d;
      try {
        const r = await fetch(
          `https://api.microlink.io/?url=${encodeURIComponent(d.affiliateLink)}`,
        );
        const j = await r.json();
        const img = j?.data?.image?.url || j?.data?.logo?.url || "";
        return { ...d, image: img || PLACEHOLDER_IMG };
      } catch {
        return { ...d, image: PLACEHOLDER_IMG };
      }
    }),
  );
  return enriched;
}

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80";

export function calcDiscount(mrp: number, online: number): number {
  if (mrp <= 0) return 0;
  return Math.round(((mrp - online) / mrp) * 100);
}

export function localShopPrice(mrp: number): number {
  return Math.round(mrp * 0.95);
}

export type LootLevel = "hot" | "mid" | "low";

export function lootLevel(discount: number): LootLevel {
  if (discount > 65) return "hot";
  if (discount >= 40) return "mid";
  return "low";
}