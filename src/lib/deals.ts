export interface Deal {
  id: string;
  title: string;
  category: string;
  image: string;
  onlinePrice: number;
  mrp: number;
  affiliateLink: string;
}

// 👉 REPLACE WITH YOUR GOOGLE SHEET ID
// 1. Open your Google Sheet
// 2. Click Share → "Anyone with the link" → Viewer
// 3. Copy the ID from the URL: docs.google.com/spreadsheets/d/<THIS_ID>/edit
// Required columns (row 1 = headers):
// Title | Category | Image | OnlinePrice | MRP | AffiliateLink
export const GOOGLE_SHEET_ID = "YOUR_GOOGLE_SHEET_ID_HERE";
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
  },
];

function parseGviz(text: string): Deal[] {
  // gviz wraps JSON in: /*O_o*/\ngoogle.visualization.Query.setResponse({...});
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Invalid Sheets response");
  const json = JSON.parse(text.slice(start, end + 1));
  const cols: string[] = json.table.cols.map((c: any) =>
    String(c.label || c.id || "").trim().toLowerCase(),
  );
  return json.table.rows
    .map((row: any, i: number) => {
      const get = (key: string) => {
        const idx = cols.indexOf(key.toLowerCase());
        if (idx === -1) return "";
        const cell = row.c?.[idx];
        return cell ? (cell.v ?? "") : "";
      };
      const onlinePrice = Number(get("onlineprice")) || 0;
      const mrp = Number(get("mrp")) || 0;
      return {
        id: String(i),
        title: String(get("title") || ""),
        category: String(get("category") || "General"),
        image: String(get("image") || ""),
        onlinePrice,
        mrp,
        affiliateLink: String(get("affiliatelink") || "#"),
      };
    })
    .filter((d: Deal) => d.title && d.mrp > 0 && d.onlinePrice > 0);
}

export async function fetchDeals(): Promise<Deal[]> {
  if (!GOOGLE_SHEET_ID || GOOGLE_SHEET_ID === "YOUR_GOOGLE_SHEET_ID_HERE") {
    return FALLBACK_DEALS;
  }
  const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch sheet");
  const text = await res.text();
  const deals = parseGviz(text);
  return deals.length ? deals : FALLBACK_DEALS;
}

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