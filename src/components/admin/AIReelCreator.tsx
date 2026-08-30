import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AIReelProduct } from "@/lib/ai-reel/types";

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-primary";

export function AIReelCreator() {
  const [products, setProducts] = useState<AIReelProduct[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState("Select a product to create a reel.");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = products.find((product) => product.id === selectedId) ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingProducts(true);
      const { data, error: dbError } = await supabase
        .from("deals")
        .select("id,title,image,category,price,mrp,source")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (dbError) {
        setError(dbError.message);
        setLoadingProducts(false);
        return;
      }
      setProducts((data ?? []).map((row) => ({
        id: String(row.id),
        title: String(row.title ?? ""),
        image: row.image ?? null,
        category: String(row.category ?? "Other"),
        price: row.price ?? 0,
        mrp: row.mrp ?? null,
        source: row.source ?? null,
      })));
      setLoadingProducts(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Your admin session has expired. Please sign in again.");
    return token;
  }

  async function generate() {
    if (!selected?.image) {
      setError("This product does not have an image.");
      return;
    }
    setError(null);
    setVideoUrl(null);
    setGenerating(true);
    setStatus("Starting AI reel generation…");
    try {
      const token = await getAccessToken();
      const start = await fetch("/api/admin/ai-reel/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: selected.title, category: selected.category, image: selected.image }),
      });
      const startBody = await start.json().catch(() => null);
      if (!start.ok || !startBody?.operation) {
        throw new Error(startBody?.error || `Could not start generation (HTTP ${start.status}).`);
      }

      const operation = String(startBody.operation);
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 8000));
        setStatus("Generating your reel… this can take a little while.");
        const currentToken = await getAccessToken();
        const response = await fetch(`/api/admin/ai-reel/status?operation=${encodeURIComponent(operation)}`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error || `Could not check generation (HTTP ${response.status}).`);
        if (body?.failed) throw new Error(body.error || "Video generation failed.");
        if (body?.done && body?.downloadUrl) {
          setVideoUrl(body.downloadUrl);
          setStatus("Your reel is ready. Preview it, then save it to your phone.");
          break;
        }
      }
    } catch (e) {
      setError((e as Error).message || "Video generation failed.");
      setStatus("Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function download() {
    if (!videoUrl) return;
    try {
      const token = await getAccessToken();
      const response = await fetch(videoUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `Download failed (HTTP ${response.status}).`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "checktheprice-reel.mp4";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message || "Could not download the video.");
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">AI Reel Creator</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Select an existing deal and generate a realistic 9:16 promotional reel. The product category determines the scene.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Product / Deal</label>
          <select
            className={inputCls}
            value={selectedId}
            disabled={loadingProducts || generating}
            onChange={(event) => { setSelectedId(event.target.value); setVideoUrl(null); setError(null); }}
          >
            <option value="">{loadingProducts ? "Loading products…" : "Select a product"}</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.title}</option>
            ))}
          </select>
        </div>

        {selected && (
          <div className="rounded-md border border-border p-3">
            {selected.image && <img src={selected.image} alt="" className="mx-auto h-44 w-full rounded object-contain" />}
            <p className="mt-2 text-sm font-semibold text-foreground">{selected.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">Category: {selected.category}</p>
            <p className="text-xs text-muted-foreground">Price: ₹{Number(selected.price).toLocaleString("en-IN")}</p>
          </div>
        )}

        <button
          type="button"
          onClick={generate}
          disabled={!selected || !selected.image || generating}
          className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {generating ? "Generating Reel…" : "Generate AI Reel"}
        </button>

        <p className="text-xs text-muted-foreground">{status}</p>
        {error && <p className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-700 dark:text-red-300">{error}</p>}

        {videoUrl && (
          <div className="space-y-3">
            <video className="mx-auto w-full max-w-sm rounded-lg bg-black" src={videoUrl} controls playsInline />
            <button type="button" onClick={download} className="w-full rounded-md bg-foreground px-4 py-3 text-sm font-semibold text-background">
              Save Video to Phone
            </button>
            <p className="text-[11px] leading-snug text-muted-foreground">The generated video is not saved in the CheckThePrice database or storage. Save the MP4 to your device.</p>
          </div>
        )}
      </div>
    </section>
  );
}
