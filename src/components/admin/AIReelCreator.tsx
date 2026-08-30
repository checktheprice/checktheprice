import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { classifyReelConcept } from "@/lib/ai-reel/prompt";
import type { ReelProduct } from "@/lib/ai-reel/types";

const COLUMNS = "id,title,image,category,price,mrp,discount_percentage,source,standard_link,affiliate_link";

type Status = "idle" | "generating" | "processing" | "completed" | "failed";

function money(value?: number | null) {
  return value ? `₹${Number(value).toLocaleString("en-IN")}` : "—";
}

export function AIReelCreator() {
  const [products, setProducts] = useState<ReelProduct[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [operationName, setOperationName] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  const selected = useMemo(
    () => products.find((product) => product.id === selectedId) ?? null,
    [products, selectedId],
  );
  const concept = selected ? classifyReelConcept(selected.category, selected.title) : null;

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingProducts(true);
      const { data, error } = await supabase
        .from("deals")
        .select(COLUMNS)
        .eq("is_active", true)
        .not("image", "is", null)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (!mounted) return;
      if (error) {
        setMessage(error.message);
        setProducts([]);
      } else {
        const rows = (data ?? []) as ReelProduct[];
        setProducts(rows.filter((row) => row.image));
        if (rows[0]?.id) setSelectedId(rows[0].id);
      }
      setLoadingProducts(false);
    })();
    return () => { mounted = false; };
  }, []);

  const authHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Admin session expired. Please sign in again.");
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  }, []);

  async function postJson(path: string, body: unknown) {
    const res = await fetch(path, { method: "POST", headers: await authHeaders(), body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    return json;
  }

  async function loadVideoBlob(shouldDownload: boolean, name = "checktheprice-ai-reel.mp4", completedOperationName = operationName) {
    if (!completedOperationName) return;
    const res = await fetch("/api/admin/ai-reel/download", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ operationName: completedOperationName }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new Error(json?.error || `Download HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    setVideoUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return url;
    });
    if (shouldDownload) {
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  async function handleGenerate() {
    if (!selected) return;
    setStatus("generating");
    setMessage("Generating...");
    setOperationName(null);
    setModel(null);
    setVideoUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    try {
      const started = await postJson("/api/admin/ai-reel/start", { product: selected });
      setOperationName(started.operationName);
      setModel(started.model);
      setStatus("processing");
      setMessage("Processing...");
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        const current = await postJson("/api/admin/ai-reel/status", { operationName: started.operationName });
        if (current.failed) throw new Error(current.error || "Video generation failed.");
        if (current.done && current.hasVideo) {
          setStatus("completed");
          setMessage("Completed");
          await loadVideoBlob(false, "checktheprice-ai-reel.mp4", started.operationName);
          return;
        }
      }
      throw new Error("Generation is still processing. Try again in a moment.");
    } catch (err) {
      setStatus("failed");
      setMessage((err as Error).message || "Failed. Try again.");
    }
  }

  return (
    <section id="ai-reel-creator" className="mt-8 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Admin</p>
        <h2 className="text-xl font-bold text-foreground">AI Reel Creator</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Select an existing deal and generate a vertical product/lifestyle reel. Generated MP4s are only previewed/downloaded in this browser and are not saved to the app.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Select Product</label>
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          value={selectedId}
          disabled={loadingProducts || status === "generating" || status === "processing"}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {loadingProducts ? <option>Loading products...</option> : null}
          {!loadingProducts && products.length === 0 ? <option>No products found</option> : null}
          {products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
        </select>
      </div>

      {selected && (
        <div className="mt-4 rounded-lg border border-border bg-background p-3">
          <img src={selected.image} alt={selected.title} className="mx-auto max-h-56 rounded-md border border-border object-contain" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">{selected.title}</h3>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div><dt className="text-muted-foreground">Category</dt><dd className="font-medium text-foreground">{selected.category || "Other"}</dd></div>
            <div><dt className="text-muted-foreground">Price</dt><dd className="font-medium text-foreground">{money(selected.price)}</dd></div>
            <div><dt className="text-muted-foreground">Marketplace</dt><dd className="font-medium text-foreground">{selected.source || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Video concept</dt><dd className="font-medium capitalize text-foreground">{concept}</dd></div>
          </dl>
        </div>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={!selected || status === "generating" || status === "processing"}
        className="mt-4 w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {status === "generating" ? "Generating..." : status === "processing" ? "Processing..." : status === "failed" ? "Try Again" : "Generate Reel"}
      </button>

      {message && <p className={`mt-3 rounded-md border p-2 text-sm ${status === "failed" ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300" : "border-border bg-muted/50 text-muted-foreground"}`}>{message}</p>}
      {model && <p className="mt-2 text-[11px] text-muted-foreground">Gemini/Veo model: {model}</p>}

      {status === "completed" && (
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Video Preview</h3>
          {videoUrl ? <video src={videoUrl} controls playsInline className="mx-auto aspect-[9/16] max-h-[520px] rounded-lg border border-border bg-black" /> : <p className="text-xs text-muted-foreground">Loading preview...</p>}
          <button type="button" onClick={() => loadVideoBlob(true)} className="w-full rounded-md border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted">Save Video</button>
        </div>
      )}
    </section>
  );
}
