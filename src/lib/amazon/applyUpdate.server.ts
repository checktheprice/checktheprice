// Smart, non-destructive sync of Amazon PA API data into the existing
// `deals` / `deal_price_history` tables. Server-only.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { getItems } from "./getItems";
import { extractAsin, type NormalizedProduct } from "./normalize";
import { payloadHash } from "./client";

type DealRow = {
  id: string;
  title: string;
  image: string | null;
  price: number;
  mrp: number;
  discount_percentage: number;
  source: string | null;
  standard_link: string | null;
  affiliate_link: string;
  metadata: Record<string, unknown> | null;
  asin: string | null;
};

const DEAL_COLUMNS =
  "id,title,image,price,mrp,discount_percentage,source,standard_link,affiliate_link,metadata,asin";

function calcDiscountPct(mrp: number, price: number): number {
  if (!mrp || mrp <= 0 || price <= 0 || price >= mrp) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

export type ApplyResult = {
  dealId: string;
  asin: string | null;
  status: "updated" | "price-changed" | "unchanged" | "skipped";
  reason?: string;
};

export async function applyUpdate(deal: DealRow, live: NormalizedProduct): Promise<ApplyResult> {
  const hash = payloadHash(live);

  // Nothing usable came back — keep last-known-good data, just note the check.
  if (live.currentPrice == null || live.currentPrice <= 0) {
    await supabaseAdmin
      .from("deals")
      .update({ last_checked_at: new Date().toISOString() })
      .eq("id", deal.id);
    console.warn(`[amazon] deal ${deal.id} asin=${live.asin} skipped: Amazon returned no usable price`);
    return { dealId: deal.id, asin: live.asin, status: "skipped", reason: "no live price" };
  }

  const newPrice = Math.round(live.currentPrice * 100) / 100;
  // Admin-set MRP wins; only fall back to Amazon's list price when the deal has none.
  const amazonMrp = live.listPrice != null && live.listPrice > 0 ? Math.round(live.listPrice * 100) / 100 : null;
  const newMrp = Number(deal.mrp) > 0 ? Number(deal.mrp) : (amazonMrp ?? Number(deal.mrp));
  const priceChanged = Number(deal.price) !== newPrice;

  const metadata = {
    ...(deal.metadata ?? {}),
    amazon: {
      asin: live.asin,
      brand: live.brand,
      currency: live.currency,
      list_price: live.listPrice,
      savings_amount: live.savingsAmount,
      discount_percent: live.discountPercent,
      availability: live.availability,
      rating: live.rating,
      review_count: live.reviewCount,
      previous_price: priceChanged ? Number(deal.price) : (deal.metadata?.amazon as { previous_price?: number } | undefined)?.previous_price ?? null,
      fetched_at: live.fetchedAt,
    },
  };

  const patch = {
    price: newPrice,
    mrp: newMrp,
    discount_percentage: calcDiscountPct(newMrp, newPrice),
    metadata,
    asin: live.asin,
    last_checked_at: new Date().toISOString(),
    last_amazon_payload_hash: hash,
  } as {
    price: number;
    mrp: number;
    discount_percentage: number;
    metadata: Json;
    asin: string;
    last_checked_at: string;
    last_amazon_payload_hash: string;
    title?: string;
    image?: string;
    affiliate_link?: string;
    standard_link?: string;
  };

  // Admin-managed content is never overwritten; only backfill when empty.
  if (!deal.title && live.title) patch.title = live.title;
  if (!deal.image && live.image) patch.image = live.image;
  if (!deal.affiliate_link || deal.affiliate_link === "#") patch.affiliate_link = live.affiliateLink;
  if (!deal.standard_link) patch.standard_link = live.standardLink;

  const { error } = await supabaseAdmin.from("deals").update(patch).eq("id", deal.id);
  if (error) throw new Error(`deals update failed: ${error.message}`);

  console.log(
    `[amazon] deal ${deal.id} asin=${live.asin} price ${deal.price} -> ${newPrice} (mrp ${newMrp}, changed=${priceChanged})`,
  );

  if (priceChanged) {
    // Append-only history; never overwritten.
    const { error: histError } = await supabaseAdmin
      .from("deal_price_history")
      .insert({ deal_id: deal.id, price: newPrice, mrp: newMrp });
    if (histError) console.error("[amazon] price history insert failed", histError.message);
  }

  return { dealId: deal.id, asin: live.asin, status: priceChanged ? "price-changed" : "updated" };
}

function asinFor(deal: DealRow): string | null {
  return deal.asin ?? extractAsin(deal.standard_link) ?? extractAsin(deal.affiliate_link);
}

/** Hydrate a single deal right after it is imported (Firecrawl flow). */
export async function hydrateDeal(dealId: string): Promise<ApplyResult> {
  const { data, error } = await supabaseAdmin
    .from("deals")
    .select(DEAL_COLUMNS)
    .eq("id", dealId)
    .maybeSingle();
  if (error) throw new Error(`deal lookup failed: ${error.message}`);
  if (!data) return { dealId, asin: null, status: "skipped", reason: "deal not found" };

  const deal = data as unknown as DealRow;
  const asin = asinFor(deal);
  if (!asin) return { dealId, asin: null, status: "skipped", reason: "no ASIN" };

  const [live] = await getItems([asin]);
  if (!live) return { dealId, asin, status: "skipped", reason: "no PA API result" };
  return applyUpdate(deal, live);
}

/** Refresh the least-recently-checked Amazon deals. */
export async function refreshBatch(limit = 30): Promise<{
  checked: number;
  updated: number;
  skipped: number;
  withoutAsin: number;
  results: ApplyResult[];
}> {
  const { data, error } = await supabaseAdmin
    .from("deals")
    .select(DEAL_COLUMNS)
    .eq("is_active", true)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw new Error(`deal batch lookup failed: ${error.message}`);

  const deals = (data ?? []) as unknown as DealRow[];
  const withAsin = deals
    .map((d) => ({ deal: d, asin: asinFor(d) }))
    .filter((x): x is { deal: DealRow; asin: string } => Boolean(x.asin));

  const withoutAsin = deals.filter((d) => !asinFor(d));
  for (const d of withoutAsin) {
    console.warn(`[amazon] deal ${d.id} skipped: no valid ASIN (source=${d.source ?? "unknown"})`);
  }
  console.log(
    `[amazon] refresh selected ${deals.length} deal(s); ${withAsin.length} with ASIN, ${withoutAsin.length} skipped`,
  );

  if (withAsin.length === 0) {
    return { checked: 0, updated: 0, skipped: 0, withoutAsin: withoutAsin.length, results: [] };
  }

  const lives = await getItems(withAsin.map((x) => x.asin));
  const byAsin = new Map(lives.map((l) => [l.asin, l]));

  const results: ApplyResult[] = [];
  for (const { deal, asin } of withAsin) {
    const live = byAsin.get(asin);
    if (!live) {
      results.push({ dealId: deal.id, asin, status: "skipped", reason: "no PA API result" });
      continue;
    }
    try {
      results.push(await applyUpdate(deal, live));
    } catch (e) {
      results.push({ dealId: deal.id, asin, status: "skipped", reason: (e as Error).message });
    }
  }

  const updated = results.filter((r) => r.status === "updated" || r.status === "price-changed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  console.log(`[amazon] refresh finished: ${updated} updated, ${skipped} skipped, ${withoutAsin.length} without ASIN`);

  return {
    checked: results.length,
    updated,
    skipped,
    withoutAsin: withoutAsin.length,
    results: [...results, ...withoutAsin.map((d) => ({ dealId: d.id, asin: null, status: "skipped" as const, reason: "no ASIN" }))],
  };
}
