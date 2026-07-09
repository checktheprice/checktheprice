import { supabase } from "@/integrations/supabase/client";
import type { Deal } from "@/lib/deals";

export async function fetchDbDeals(): Promise<Deal[]> {
  const { data, error } = await supabase
    .from("deals")
    .select(
      "id,title,image,category,price,mrp,discount_percentage,source,standard_link,affiliate_link,coupon_code,hot_deal,is_active,created_at,updated_at",
    )
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[db-deals] fetch failed", error);
    return [];
  }

  return (data ?? []).map((r): Deal => {
    const src = String(r.source || "").toLowerCase();
    const source =
      src === "amazon" ? "Amazon" : src === "flipkart" ? "Flipkart" : r.source ? "Other" : undefined;
    return {
      id: `db-${r.id}`,
      title: r.title,
      category: r.category || "General",
      image: r.image || "",
      onlinePrice: Number(r.price) || 0,
      mrp: Number(r.mrp) || 0,
      affiliateLink: r.affiliate_link || "#",
      source,
      couponCode: r.coupon_code || undefined,
      hotDeal: !!r.hot_deal,
      addedAt: r.created_at ? new Date(r.created_at).getTime() : undefined,
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : undefined,
    };
  });
}
