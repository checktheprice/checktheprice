/**
 * Persistence of comparison-discovered offers into the EXISTING
 * `deals` / `deal_price_history` tables (server only). No new tables.
 *
 * Model: one `deals` row per canonical merchant product URL
 * (`standard_link` is the upsert conflict key, matched application-side like
 * the /api/prometheus webhook). Price history is produced by the database
 * triggers that already snapshot on insert and on price change — this module
 * never writes `deal_price_history` directly.
 *
 * Rows discovered ONLY through comparison searches are inserted with
 * `is_active = false` so they never surface as published deals, and updates
 * never overwrite stronger existing data (title, category, admin-set MRP,
 * is_active, asin) with incomplete comparison data. Comparison-specific
 * fields live under `metadata.compare`, mirroring the `metadata.amazon`
 * namespace used by the PA API sync.
 */
import type { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";
import { canonicalLink } from "@/lib/scrape/firecrawl.server";
import { calcDiscount } from "@/lib/deals";
import type { CompareOffer, CompareResult } from "./types";

type DealUpdate = Database["public"]["Tables"]["deals"]["Update"];

export type CompareProvider = "serpapi" | "firecrawl_fallback";

type AdminClient = typeof supabaseAdmin;

/** Merchants whose product identity is fully path-based → drop ALL params. */
const PATH_BASED_HOSTS = [
  "croma.com",
  "reliancedigital.in",
  "tatacliq.com",
  "vijaysales.com",
  "jiomart.com",
];

/** Common affiliate/tracking params stripped from unknown-merchant URLs. */
const TRACKING_PARAMS = new Set([
  "gclid",
  "gclsrc",
  "fbclid",
  "msclkid",
  "srsltid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_",
  "tag",
  "linkcode",
  "ascsubtag",
  "subtag",
  "affid",
  "aff_id",
  "affiliate_id",
  "affextparam",
  "cmpid",
  "campaignid",
  "camp",
  "creative",
  "creativeasin",
  "spm",
  "otracker",
  "cid",
  "sid",
]);

function isTrackingParam(name: string): boolean {
  const n = name.toLowerCase();
  return n.startsWith("utm_") || TRACKING_PARAMS.has(n);
}

/**
 * Canonical product identity URL used as the `standard_link` conflict key.
 * Amazon/Flipkart reuse the exact canonicalization the Admin import flow
 * uses, so comparison rows and webhook/admin rows can never diverge for the
 * same product. Returns null for unparseable URLs.
 */
export function canonicalCompareLink(rawUrl: string): string | null {
  // Amazon.in / Flipkart: the shared scraper's canonical form.
  const known = canonicalLink(rawUrl);
  if (known) return known.standardLink;

  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  u.hostname = u.hostname.toLowerCase();
  u.hash = "";

  const bareHost = u.hostname.replace(/^www\./, "");
  if (PATH_BASED_HOSTS.some((h) => bareHost === h || bareHost.endsWith(`.${h}`))) {
    u.search = "";
  } else {
    const kept = [...u.searchParams.entries()].filter(([k]) => !isTrackingParam(k));
    kept.sort(([a], [b]) => a.localeCompare(b));
    u.search = "";
    for (const [k, v] of kept) u.searchParams.append(k, v);
  }

  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }
  return u.toString();
}

type ExistingDealRow = {
  id: string;
  price: number;
  mrp: number;
  image: string | null;
  affiliate_link: string;
  metadata: Record<string, unknown> | null;
};

function compareMeta(
  offer: CompareOffer,
  query: string,
  provider: CompareProvider,
  role: "selected" | "offer",
) {
  return {
    merchant: offer.merchant,
    store_raw: offer.storeRaw,
    price_label: offer.priceLabel,
    shipping: offer.shipping,
    offer: offer.offer,
    rating: offer.rating,
    reviews: offer.reviews,
    query,
    provider,
    source_url: offer.url,
    role,
    last_seen_at: new Date().toISOString(),
  };
}

export type PersistOutcome = {
  standardLink: string;
  action: "inserted" | "updated" | "unchanged" | "skipped";
  reason?: string;
};

async function upsertOffer(
  client: AdminClient,
  offer: CompareOffer,
  query: string,
  provider: CompareProvider,
  role: "selected" | "offer",
): Promise<PersistOutcome> {
  if (offer.price == null || offer.price <= 0) {
    return { standardLink: offer.url, action: "skipped", reason: "no price" };
  }
  const standardLink = canonicalCompareLink(offer.url);
  if (!standardLink) {
    return { standardLink: offer.url, action: "skipped", reason: "bad URL" };
  }

  const { data, error } = await client
    .from("deals")
    .select("id,price,mrp,image,affiliate_link,metadata")
    .eq("standard_link", standardLink)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`deals lookup failed: ${error.message}`);

  const meta = compareMeta(offer, query, provider, role);

  if (!data) {
    // New comparison-only product: inactive so it is never published as a
    // normal deal. The insert trigger snapshots the first price point.
    const { error: insErr } = await client.from("deals").insert({
      title: offer.title,
      image: offer.image,
      category: "General",
      price: offer.price,
      mrp: offer.price,
      discount_percentage: 0,
      source: offer.store,
      standard_link: standardLink,
      affiliate_link: offer.buyUrl || standardLink,
      coupon_code: null,
      hot_deal: false,
      is_active: false,
      created_by: null,
      metadata: { compare: meta },
    });
    if (insErr) throw new Error(`deals insert failed: ${insErr.message}`);
    return { standardLink, action: "inserted" };
  }

  const existing = data as unknown as ExistingDealRow;
  const patch: DealUpdate = {
    metadata: { ...(existing.metadata ?? {}), compare: meta } as Json,
  };

  const priceChanged = Number(existing.price) !== offer.price;
  if (priceChanged) {
    patch.price = offer.price;
    // Never lower an admin-set MRP; only lift a placeholder that would fall
    // below the new price (mrp is NOT NULL and must stay >= price).
    const mrp = Math.max(Number(existing.mrp) || 0, offer.price);
    if (mrp !== Number(existing.mrp)) patch.mrp = mrp;
    patch.discount_percentage = calcDiscount(mrp, offer.price);
  }
  if (!existing.image && offer.image) patch.image = offer.image;
  if ((!existing.affiliate_link || existing.affiliate_link === "#") && offer.buyUrl) {
    patch.affiliate_link = offer.buyUrl;
  }
  // Deliberately untouched: title, category, source, is_active, asin,
  // coupon_code, hot_deal — comparison data never downgrades curated rows.

  const { error: updErr } = await client.from("deals").update(patch).eq("id", existing.id);
  if (updErr) throw new Error(`deals update failed: ${updErr.message}`);
  // The update trigger snapshots deal_price_history when price/mrp changed.
  return { standardLink, action: priceChanged ? "updated" : "unchanged" };
}

/**
 * Persist a comparison result: the pinned selected product (when priced) and
 * every matched offer. Per-offer failures are logged and skipped so one bad
 * row never aborts the rest; callers must still guard the whole call so
 * persistence can never break the compare API response.
 */
export async function persistCompareResult(
  result: CompareResult,
  provider: CompareProvider,
  client?: AdminClient,
): Promise<PersistOutcome[]> {
  const targets: { offer: CompareOffer; role: "selected" | "offer" }[] = [];
  if (result.selected) targets.push({ offer: result.selected, role: "selected" });
  for (const offer of result.offers) targets.push({ offer, role: "offer" });
  if (targets.length === 0) return [];

  const db = client ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;

  const settled = await Promise.allSettled(
    targets.map((t) => upsertOffer(db, t.offer, result.query, provider, t.role)),
  );
  const outcomes: PersistOutcome[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      outcomes.push(r.value);
    } else {
      console.error(`[compare] persist failed for ${targets[i].offer.url}`, r.reason);
      outcomes.push({
        standardLink: targets[i].offer.url,
        action: "skipped",
        reason: String((r.reason as Error)?.message ?? r.reason),
      });
    }
  });
  console.log(
    `[compare] persisted: ${outcomes.filter((o) => o.action === "inserted").length} inserted, ` +
      `${outcomes.filter((o) => o.action === "updated").length} updated, ` +
      `${outcomes.filter((o) => o.action === "unchanged").length} unchanged, ` +
      `${outcomes.filter((o) => o.action === "skipped").length} skipped`,
  );
  return outcomes;
}
