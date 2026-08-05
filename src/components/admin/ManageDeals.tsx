import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calcDiscount, slugifyTitle } from "@/lib/deals";
import { CATEGORY_DISPLAY_ORDER } from "@/lib/categories";

const PAGE_SIZE = 25;

const COLUMNS =
  "id,title,image,category,price,mrp,discount_percentage,source,standard_link,affiliate_link,coupon_code,hot_deal,is_active,created_at,updated_at";

type DealRow = {
  id: string;
  title: string;
  image: string | null;
  category: string;
  price: number;
  mrp: number;
  discount_percentage: number;
  source: string | null;
  standard_link: string | null;
  affiliate_link: string;
  coupon_code: string | null;
  hot_deal: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SortKey =
  | "updated"
  | "created"
  | "discount"
  | "price-asc"
  | "price-desc"
  | "alpha";

const SORTS: Record<SortKey, { column: string; ascending: boolean; label: string }> = {
  updated: { column: "updated_at", ascending: false, label: "Latest Updated" },
  created: { column: "created_at", ascending: false, label: "Latest Created" },
  discount: { column: "discount_percentage", ascending: false, label: "Highest Discount" },
  "price-asc": { column: "price", ascending: true, label: "Lowest Price" },
  "price-desc": { column: "price", ascending: false, label: "Highest Price" },
  alpha: { column: "title", ascending: true, label: "Alphabetical" },
};

const SITE_ORIGIN = "https://checktheprice.lovable.app";

function dealUrl(row: DealRow): string {
  return `${SITE_ORIGIN}/deal/${slugifyTitle(row.title)}`;
}

type Draft = {
  title: string;
  price: string;
  mrp: string;
  category: string;
  coupon_code: string;
  affiliate_link: string;
  standard_link: string;
  hot_deal: boolean;
  is_active: boolean;
};

function toDraft(r: DealRow): Draft {
  return {
    title: r.title,
    price: String(r.price ?? ""),
    mrp: String(r.mrp ?? ""),
    category: r.category ?? "",
    coupon_code: r.coupon_code ?? "",
    affiliate_link: r.affiliate_link ?? "",
    standard_link: r.standard_link ?? "",
    hot_deal: !!r.hot_deal,
    is_active: !!r.is_active,
  };
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary";
const labelCls = "text-xs font-medium text-muted-foreground";

export function ManageDeals() {
  const [rows, setRows] = useState<DealRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [marketplace, setMarketplace] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [page, setPage] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debounced, marketplace, category, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const s = SORTS[sort];
    let q = supabase
      .from("deals")
      .select(COLUMNS, { count: "exact" })
      .order(s.column, { ascending: s.ascending })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (debounced) {
      const safe = debounced.replace(/[%,()]/g, " ");
      q = q.or(`title.ilike.%${safe}%,category.ilike.%${safe}%`);
    }
    if (marketplace !== "all") q = q.ilike("source", marketplace);
    if (category !== "all") q = q.eq("category", category);

    const { data, error: err, count } = await q;
    if (err) {
      setError(err.message);
      setRows([]);
      setTotal(0);
    } else {
      setRows((data ?? []) as DealRow[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [debounced, marketplace, category, sort, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryOptions = useMemo(() => CATEGORY_DISPLAY_ORDER, []);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function startEdit(r: DealRow) {
    setEditingId(r.id);
    setDraft(toDraft(r));
  }

  async function saveEdit(id: string) {
    if (!draft) return;
    setSavingId(id);
    setError(null);
    const priceNum = Number(draft.price.replace(/[^\d.]/g, ""));
    const mrpNum = Number(draft.mrp.replace(/[^\d.]/g, ""));
    if (!priceNum || !mrpNum) {
      setError("Price and MRP must be valid numbers.");
      setSavingId(null);
      return;
    }
    const { error: err } = await supabase
      .from("deals")
      .update({
        title: draft.title,
        price: priceNum,
        mrp: mrpNum,
        discount_percentage: calcDiscount(mrpNum, priceNum),
        category: draft.category,
        coupon_code: draft.coupon_code || null,
        affiliate_link: draft.affiliate_link,
        standard_link: draft.standard_link || null,
        hot_deal: draft.hot_deal,
        is_active: draft.is_active,
      })
      .eq("id", id);
    setSavingId(null);
    if (err) {
      setError(err.message);
      return;
    }
    setEditingId(null);
    setDraft(null);
    await load();
  }

  async function toggleActive(r: DealRow) {
    setSavingId(r.id);
    const next = !r.is_active;
    const { error: err } = await supabase
      .from("deals")
      .update({ is_active: next })
      .eq("id", r.id);
    setSavingId(null);
    if (err) {
      setError(err.message);
      return;
    }
    setRows((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, is_active: next } : x)),
    );
  }

  async function deleteDeal(id: string) {
    setDeletingId(id);
    const { error: err } = await supabase.from("deals").delete().eq("id", id);
    setDeletingId(null);
    setConfirmId(null);
    if (err) {
      setError(err.message);
      return;
    }
    await load();
  }

  async function copyUrl(r: DealRow) {
    const u = dealUrl(r);
    try {
      await navigator.clipboard.writeText(u);
    } catch {
      return;
    }
    setCopiedId(r.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <section className="mt-8">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Manage Deals</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {total} deal{total === 1 ? "" : "s"} in the website database.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
        >
          {loading ? "Refreshing…" : "Refresh Deals"}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <input
          className={inputCls}
          placeholder="Search title or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Marketplace</label>
            <select
              className={inputCls}
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value)}
            >
              <option value="all">All</option>
              <option value="Amazon">Amazon</option>
              <option value="Flipkart">Flipkart</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <select
              className={inputCls}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">All</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Sort by</label>
          <select
            className={inputCls}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            {(Object.keys(SORTS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORTS[k].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-border bg-muted/50"
            />
          ))}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="mt-4 rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No deals found.
          <br />
          Publish your first deal above.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="mt-4 space-y-3">
          {rows.map((r) => {
            const isEditing = editingId === r.id;
            const busy = savingId === r.id;
            return (
              <div
                key={r.id}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex gap-3">
                  {r.image ? (
                    <img
                      src={r.image}
                      alt={r.title}
                      loading="lazy"
                      className="h-16 w-16 shrink-0 rounded border border-border object-contain"
                    />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded border border-border bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-foreground">
                      {r.title}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {r.category} · {r.source || "—"} · {r.discount_percentage}% off
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      ₹{r.price} <s>₹{r.mrp}</s> · updated{" "}
                      {new Date(r.updated_at).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <label className="flex items-center gap-1 font-medium text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={r.is_active}
                      disabled={busy}
                      onChange={() => void toggleActive(r)}
                    />
                    {r.is_active ? "Active" : "Inactive"}
                  </label>
                  {r.hot_deal && (
                    <span className="rounded bg-[#ff9900]/15 px-1.5 py-0.5 font-semibold text-[#b36b00]">
                      Hot
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void copyUrl(r)}
                    className="rounded border border-border px-2 py-0.5 font-medium text-muted-foreground hover:bg-muted"
                  >
                    {copiedId === r.id ? "Copied!" : "📋 Copy"}
                  </button>
                  <a
                    href={dealUrl(r)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-border px-2 py-0.5 font-medium text-muted-foreground hover:bg-muted"
                  >
                    Open
                  </a>
                  <button
                    type="button"
                    onClick={() => (isEditing ? setEditingId(null) : startEdit(r))}
                    className="rounded border border-border px-2 py-0.5 font-medium text-foreground hover:bg-muted"
                  >
                    {isEditing ? "Close" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(r.id)}
                    disabled={deletingId === r.id}
                    className="rounded border border-red-500/40 px-2 py-0.5 font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-60"
                  >
                    {deletingId === r.id ? "Deleting…" : "Delete"}
                  </button>
                </div>

                {confirmId === r.id && (
                  <div className="mt-2 rounded-md border border-red-500/40 bg-red-500/5 p-2 text-[12px]">
                    <p className="font-medium text-foreground">
                      Delete this deal permanently?
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded border border-border px-2 py-1 font-medium text-muted-foreground hover:bg-muted"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteDeal(r.id)}
                        disabled={deletingId === r.id}
                        className="rounded bg-red-600 px-2 py-1 font-semibold text-white disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                {isEditing && draft && (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    <div>
                      <label className={labelCls}>Title</label>
                      <input
                        className={inputCls}
                        value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Price</label>
                        <input
                          className={inputCls}
                          inputMode="decimal"
                          value={draft.price}
                          onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>MRP</label>
                        <input
                          className={inputCls}
                          inputMode="decimal"
                          value={draft.mrp}
                          onChange={(e) => setDraft({ ...draft, mrp: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Category</label>
                      <select
                        className={inputCls}
                        value={draft.category}
                        onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                      >
                        {!categoryOptions.includes(
                          draft.category as (typeof categoryOptions)[number],
                        ) && <option value={draft.category}>{draft.category}</option>}
                        {categoryOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Coupon Code</label>
                      <input
                        className={inputCls}
                        value={draft.coupon_code}
                        onChange={(e) =>
                          setDraft({ ...draft, coupon_code: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Website Deal URL</label>
                      <input
                        className={`${inputCls} bg-muted/60 text-muted-foreground`}
                        value={dealUrl(r)}
                        readOnly
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Generated from the title — editing the title changes this URL.
                      </p>
                    </div>
                    <div>
                      <label className={labelCls}>Affiliate Link</label>
                      <input
                        className={inputCls}
                        value={draft.affiliate_link}
                        onChange={(e) =>
                          setDraft({ ...draft, affiliate_link: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Standard Link</label>
                      <input
                        className={inputCls}
                        value={draft.standard_link}
                        onChange={(e) =>
                          setDraft({ ...draft, standard_link: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-4 text-[12px] text-muted-foreground">
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={draft.hot_deal}
                          onChange={(e) =>
                            setDraft({ ...draft, hot_deal: e.target.checked })
                          }
                        />
                        Hot Deal / Featured
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={draft.is_active}
                          onChange={(e) =>
                            setDraft({ ...draft, is_active: e.target.checked })
                          }
                        />
                        Active
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => void saveEdit(r.id)}
                      disabled={busy}
                      className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                    >
                      {busy ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-[12px]">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded border border-border px-2 py-1 font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-muted-foreground">
            Page {page + 1} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
            className="rounded border border-border px-2 py-1 font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
