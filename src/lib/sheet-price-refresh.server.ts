import { creatorsRequest } from "@/lib/amazon/client";
import { GET_ITEMS_RESOURCES } from "@/lib/amazon/resources";
import { normalizeItem, extractAsin, type CreatorsItem } from "@/lib/amazon/normalize";

const DEFAULT_SHEET_ID = "1OaATk_qm7XIRDbC9T59FIAapXmYNhY3fLVdLa94kAeY";
const SHEET2 = "Sheet2";
const SHEET1 = "Sheet1";
const BATCH = 10;

type Row = { row: number; asin: string; price: number };
type ApiResponse = { itemsResult?: { items?: CreatorsItem[] }; itemResults?: { items?: CreatorsItem[] }; ItemsResult?: { Items?: CreatorsItem[] }; errors?: Array<{ code?: string; message?: string; type?: string }>; Errors?: Array<{ code?: string; message?: string; type?: string }> };

export type SheetRefreshResult = {
  checked: number;
  priceChanged: number;
  unchanged: number;
  skipped: number;
  details: Array<{ row: number; asin?: string; status: string; oldPrice?: number; newPrice?: number; reason?: string }>;
};

function sheetId() { return process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID; }
function appsScriptUrl() { const value = process.env.GOOGLE_SHEET_APPS_SCRIPT_URL; if (!value) throw new Error("GOOGLE_SHEET_APPS_SCRIPT_URL is not configured"); return value; }
function normalizeHeader(v: unknown) { return String(v ?? "").trim().toLowerCase().replace(/[\s_-]/g, ""); }
function priceOf(v: unknown) { const n = Number(String(v ?? "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : 0; }
function itemList(data: ApiResponse): CreatorsItem[] { return data.itemsResult?.items ?? data.itemResults?.items ?? data.ItemsResult?.Items ?? []; }

async function readSheet2(): Promise<Row[]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId()}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET2)}&_cb=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Sheet2 read failed: HTTP ${response.status}`);
  const text = await response.text();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Invalid Google Sheets response");
  const json = JSON.parse(text.slice(start, end + 1));
  const cols = (json.table?.cols ?? []).map((c: any) => normalizeHeader(c.label || c.id));
  const rows: Row[] = [];
  (json.table?.rows ?? []).forEach((r: any, index: number) => {
    const get = (...keys: string[]) => {
      for (const key of keys) {
        const column = cols.indexOf(normalizeHeader(key));
        if (column >= 0) return r.c?.[column]?.v ?? "";
      }
      return "";
    };
    const links = [get("standard_link", "standardlink"), get("affiliate_link", "affiliatelink"), get("url", "producturl")];
    const asin = links.map((link) => extractAsin(String(link))).find(Boolean) ?? null;
    const price = priceOf(get("price", "onlineprice"));
    if (asin && price > 0) rows.push({ row: index + 2, asin, price });
  });
  return rows;
}

async function getFreshItems(asins: string[]) {
  const unique = Array.from(new Set(asins));
  const products = [] as ReturnType<typeof normalizeItem>[];
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    console.log(`[sheet-refresh] GetItems ${batch.join(",")}`);
    const data = await creatorsRequest<ApiResponse>("GetItems", {
      itemIds: batch,
      itemIdType: "ASIN",
      resources: GET_ITEMS_RESOURCES,
    });
    const errors = data.errors ?? data.Errors ?? [];
    if (errors.length) {
      for (const error of errors) console.error(`[sheet-refresh] Amazon error ${error.code ?? error.type ?? "unknown"}: ${error.message ?? "n/a"}`);
    }
    const items = itemList(data);
    console.log(`[sheet-refresh] Amazon returned ${items.length}/${batch.length}`);
    for (const item of items) {
      const normalized = normalizeItem(item);
      if (normalized.asin) products.push(normalized);
    }
    if (items.length === 0 && errors.length) {
      throw new Error(`Creators API GetItems failed: ${errors[0].code ?? errors[0].type ?? "unknown"} - ${errors[0].message ?? "no message"}`);
    }
  }
  return products;
}

async function writeChanges(updates: Array<{ row: number; asin: string; price: number }>) {
  if (!updates.length) return;
  const response = await fetch(appsScriptUrl(), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "updatePriceAndTimestamp",
      spreadsheetId: sheetId(),
      priceSheet: SHEET2,
      timestampSheet: SHEET1,
      updates,
      timestamp: new Date().toISOString(),
      secret: process.env.GOOGLE_SHEET_SYNC_SECRET || "",
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Google Apps Script write failed: HTTP ${response.status} ${text.slice(0, 300)}`);
  let result: any;
  try { result = JSON.parse(text); } catch { throw new Error(`Google Apps Script returned invalid JSON: ${text.slice(0, 300)}`); }
  if (!result.ok) throw new Error(result.error || "Google Apps Script update failed");
}

export async function refreshSheetPrices(): Promise<SheetRefreshResult> {
  const rows = await readSheet2();
  const result: SheetRefreshResult = { checked: rows.length, priceChanged: 0, unchanged: 0, skipped: 0, details: [] };
  if (!rows.length) return result;

  const liveProducts = await getFreshItems(rows.map((row) => row.asin));
  const byAsin = new Map(liveProducts.map((product) => [product.asin, product]));
  const updates: Array<{ row: number; asin: string; price: number }> = [];

  for (const row of rows) {
    const live = byAsin.get(row.asin);
    if (!live?.currentPrice || live.currentPrice <= 0) {
      result.skipped++;
      result.details.push({ row: row.row, asin: row.asin, status: "skipped", reason: "no usable Amazon price" });
      continue;
    }
    const newPrice = Math.round(live.currentPrice * 100) / 100;
    if (newPrice === row.price) {
      result.unchanged++;
      result.details.push({ row: row.row, asin: row.asin, status: "unchanged", oldPrice: row.price, newPrice });
      continue;
    }
    updates.push({ row: row.row, asin: row.asin, price: newPrice });
    result.priceChanged++;
    result.details.push({ row: row.row, asin: row.asin, status: "price-changed", oldPrice: row.price, newPrice });
  }

  // Only changed Sheet2 prices are written. Sheet1 is touched only for the
  // corresponding `updated` timestamp. All other fields remain untouched.
  await writeChanges(updates);
  return result;
}
