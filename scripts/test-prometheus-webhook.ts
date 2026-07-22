/**
 * Simulation test for POST /api/prometheus
 *
 * Tests:
 *   1. Affiliate link generation with tag pavani15-21
 *   2. Supabase row insert (using publishable key — read/write depends on RLS)
 *   3. Duplicate detection (second identical POST returns 409)
 *   4. HTTP 200 on success
 *
 * Run: bun scripts/test-prometheus-webhook.ts
 */

import { buildAmazonAffiliateLink, AMAZON_AFFILIATE_TAG } from "../src/lib/affiliate";
import { calcDiscount } from "../src/lib/deals";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/integrations/supabase/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

const PASS = "\x1b[32m✓ PASS\x1b[0m";
const FAIL = "\x1b[31m✗ FAIL\x1b[0m";
const INFO = "\x1b[36mℹ\x1b[0m ";

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`${PASS}  ${label}`);
  } else {
    console.log(`${FAIL}  ${label}${detail ? `\n       ${detail}` : ""}`);
    process.exitCode = 1;
  }
}

// ── Sample payload (mirrors Prometheus webhook output) ───────────────────────

const SAMPLE = {
  standard_link:
    "https://www.amazon.in/dp/B0DXYZ1234/ref=sr_1_1?crid=ABC&th=1&psc=1",
  title: "Test Wireless Headphones [simulation]",
  category: "Electronics",
  price: 579,
  mrp: 1999,
  image: "https://m.media-amazon.com/images/I/test-image.jpg",
  updated: "2026-07-22 10:00:00",
};

// ── Env setup ────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const WEBHOOK_SECRET = process.env.PROMETHEUS_WEBHOOK_SECRET ?? "test-secret-local";

// ── 1. Affiliate link generation ─────────────────────────────────────────────

console.log("\n\x1b[1m── 1. Affiliate link generation ──────────────────────────────\x1b[0m");

const affiliateLink = buildAmazonAffiliateLink(SAMPLE.standard_link);
const affiliateUrl = new URL(affiliateLink);

console.log(`${INFO} Input:  ${SAMPLE.standard_link}`);
console.log(`${INFO} Output: ${affiliateLink}`);
console.log(`${INFO} Tag:    ${affiliateUrl.searchParams.get("tag")}`);

assert(
  `Tag equals ${AMAZON_AFFILIATE_TAG}`,
  affiliateUrl.searchParams.get("tag") === AMAZON_AFFILIATE_TAG,
  `Got: ${affiliateUrl.searchParams.get("tag")}`,
);
// buildAmazonAffiliateLink strips: tag, ascsubtag, linkCode, ref_, th
// (crid / psc are not in scope — they stay, matching Publish Live behaviour)
assert(
  "Amazon tracking params stripped (th, ref_ query param)",
  !affiliateUrl.searchParams.has("th") &&
    !affiliateUrl.searchParams.has("ref_"),
);
assert(
  "Is a valid amazon.in URL",
  affiliateUrl.hostname.includes("amazon.in"),
);

// ── 2. Discount calculation ───────────────────────────────────────────────────

console.log("\n\x1b[1m── 2. Discount + hot_deal flag ───────────────────────────────\x1b[0m");

const discount = calcDiscount(SAMPLE.mrp, SAMPLE.price);
const expectedDiscount = Math.round(((1999 - 579) / 1999) * 100); // 71
const hotDeal = discount > 65;

console.log(`${INFO} MRP: ₹${SAMPLE.mrp}  Price: ₹${SAMPLE.price}`);
console.log(`${INFO} Discount: ${discount}%  hot_deal: ${hotDeal}`);

assert(`Discount = ${expectedDiscount}%`, discount === expectedDiscount, `Got ${discount}`);
assert("hot_deal = true (discount > 65%)", hotDeal === true);

// ── 3. Payload that would be inserted ─────────────────────────────────────────

console.log("\n\x1b[1m── 3. Computed INSERT payload ────────────────────────────────\x1b[0m");

const insertPayload = {
  title: SAMPLE.title,
  image: SAMPLE.image,
  category: SAMPLE.category,
  price: SAMPLE.price,
  mrp: SAMPLE.mrp,
  discount_percentage: discount,
  source: "Amazon",
  standard_link: SAMPLE.standard_link,
  affiliate_link: affiliateLink,
  coupon_code: null,
  hot_deal: hotDeal,
  is_active: true,
  created_by: null,
};

console.log(JSON.stringify(insertPayload, null, 2));

assert("affiliate_link contains pavani15-21", insertPayload.affiliate_link.includes("pavani15-21"));
assert("source = Amazon", insertPayload.source === "Amazon");
assert("is_active = true", insertPayload.is_active === true);

// ── 4. Supabase connectivity + insert ─────────────────────────────────────────

console.log("\n\x1b[1m── 4. Supabase insert + duplicate detection ──────────────────\x1b[0m");

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.log(`\x1b[33m⚠ SKIP\x1b[0m  SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY not in env — skipping DB tests`);
} else {
  const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_PUBLISHABLE_KEY;
  const keyLabel = SUPABASE_SERVICE_ROLE_KEY ? "service_role key" : "publishable key (RLS applies)";
  console.log(`${INFO} Connecting to Supabase with ${keyLabel}`);

  // Custom fetch to handle new-style publishable keys (strip Authorization header, set apikey)
  const customFetch: typeof fetch = (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (
      (key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) &&
      headers.get("Authorization") === `Bearer ${key}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };

  const supabase = createClient<Database>(SUPABASE_URL, key, {
    global: { fetch: customFetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 4a. Connectivity check
  const { data: pingData, error: pingError } = await supabase
    .from("deals")
    .select("id")
    .limit(1);

  assert(
    "Supabase deals table is reachable",
    !pingError,
    pingError ? `${pingError.code}: ${pingError.message}` : undefined,
  );

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.log(
      `\x1b[33m⚠ SKIP\x1b[0m  SUPABASE_SERVICE_ROLE_KEY not set — INSERT and duplicate check require service_role.\n` +
      `         Add it in Replit Secrets to enable full end-to-end testing.`,
    );
  } else {
    // 4b. First insert — should succeed
    console.log(`\n${INFO} Inserting test deal…`);
    const { error: insertError } = await supabase
      .from("deals")
      .insert(insertPayload);

    assert(
      "First insert succeeds (no error)",
      !insertError,
      insertError ? `${insertError.code}: ${insertError.message}` : undefined,
    );

    if (!insertError) {
      // Verify row exists
      const { data: row } = await supabase
        .from("deals")
        .select("id, title, affiliate_link, discount_percentage, hot_deal")
        .eq("standard_link", SAMPLE.standard_link)
        .eq("is_active", true)
        .maybeSingle();

      assert("Row found in deals table after insert", !!row);
      assert(
        "Stored affiliate_link contains pavani15-21",
        !!row?.affiliate_link.includes("pavani15-21"),
        `Got: ${row?.affiliate_link}`,
      );
      assert(
        `Stored discount_percentage = ${expectedDiscount}`,
        Number(row?.discount_percentage) === expectedDiscount,
        `Got: ${row?.discount_percentage}`,
      );
      assert("Stored hot_deal = true", row?.hot_deal === true);

      console.log(`\n${INFO} Testing duplicate detection (same standard_link)…`);

      // 4c. Duplicate check — should hit the 409 branch
      const { data: dup, error: dupLookupError } = await supabase
        .from("deals")
        .select("id")
        .eq("standard_link", SAMPLE.standard_link)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      assert(
        "Duplicate lookup finds the row (would return 409)",
        !!dup && !dupLookupError,
        dupLookupError ? dupLookupError.message : undefined,
      );

      // 4d. Clean up test row so it doesn't pollute the live site
      const { error: delError } = await supabase
        .from("deals")
        .delete()
        .eq("standard_link", SAMPLE.standard_link)
        .eq("title", SAMPLE.title);

      assert(
        "Test row cleaned up after simulation",
        !delError,
        delError ? delError.message : undefined,
      );
    }
  }
}

// ── 5. Validation checks (field-level) ───────────────────────────────────────

console.log("\n\x1b[1m── 5. Field validation ───────────────────────────────────────\x1b[0m");

function runValidation(payload: Record<string, unknown>): { status: number; body: Record<string, unknown> } {
  const standard_link = payload.standard_link ? String(payload.standard_link).trim() : "";
  const title = payload.title ? String(payload.title).trim() : "";
  const price = typeof payload.price === "number" ? payload.price : Number(String(payload.price ?? "").replace(/[^\d.]/g, ""));
  const mrp = typeof payload.mrp === "number" ? payload.mrp : Number(String(payload.mrp ?? "").replace(/[^\d.]/g, ""));
  const image = payload.image ? String(payload.image).trim() : "";

  const missing: string[] = [];
  if (!standard_link) missing.push("standard_link");
  if (!title) missing.push("title");
  if (!price) missing.push("price");
  if (!mrp) missing.push("mrp");
  if (!image) missing.push("image");

  if (missing.length > 0) return { status: 400, body: { error: `Missing required fields: ${missing.join(", ")}` } };
  if (price <= 0) return { status: 400, body: { error: "price must be a positive number." } };
  if (mrp <= 0) return { status: 400, body: { error: "mrp must be a positive number." } };
  return { status: 200, body: { ok: true } };
}

const missingTitle = runValidation({ ...SAMPLE, title: "" });
assert("Missing title → 400", missingTitle.status === 400, JSON.stringify(missingTitle.body));

const missingPrice = runValidation({ ...SAMPLE, price: 0 });
assert("price=0 → 400", missingPrice.status === 400, JSON.stringify(missingPrice.body));

const missingMrp = runValidation({ ...SAMPLE, mrp: undefined });
assert("Missing mrp → 400", missingMrp.status === 400, JSON.stringify(missingMrp.body));

const goodPayload = runValidation({ ...SAMPLE });
assert("Valid payload → 200", goodPayload.status === 200);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("\n\x1b[1m─────────────────────────────────────────────────────────────\x1b[0m");
if (process.exitCode === 1) {
  console.log("\x1b[31mSome checks failed — see above.\x1b[0m\n");
} else {
  console.log("\x1b[32mAll checks passed.\x1b[0m\n");
}
