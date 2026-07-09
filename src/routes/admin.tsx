import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { buildAmazonAffiliateLink } from "@/lib/affiliate";
import { calcDiscount } from "@/lib/deals";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Mobile Admin — CheckThePrice" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Internal admin tool." },
    ],
  }),
});

type Scraped = {
  title: string;
  category: string;
  price: string;
  mrp: string;
  image: string;
  updated: string;
};

const LS_KEY = "ctp_admin_config_v1";

type Config = {
  firecrawlKey: string;
  spreadsheetId: string;
  sheetTab: string;
  appsScriptUrl: string;
};

const emptyScraped: Scraped = {
  title: "",
  category: "",
  price: "",
  mrp: "",
  image: "",
  updated: "",
};

function formatISTTimestamp(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}:${get("second")}`;
}

function AdminPage() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<"checking" | "ok" | "denied">("checking");
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!userData.user) {
        navigate({ to: "/auth" });
        return;
      }
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      if (!mounted) return;
      if (!isAdmin) {
        setAuthState("denied");
        return;
      }
      setAdminEmail(userData.user.email ?? null);
      setAuthState("ok");
    })();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const [config, setConfig] = useState<Config>({
    firecrawlKey: "",
    spreadsheetId: "",
    sheetTab: "Sheet2",
    appsScriptUrl: "",
  });
  const [url, setUrl] = useState("");
  const [scraped, setScraped] = useState<Scraped>(emptyScraped);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setConfig({ ...JSON.parse(raw) });
    } catch {}
  }, []);

  function saveConfig(next: Config) {
    setConfig(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {}
  }

  async function handleFetch() {
    setMsg(null);
    if (!url.trim()) {
      setMsg({ type: "err", text: "Paste an Amazon product URL first." });
      return;
    }
    if (!config.firecrawlKey) {
      setMsg({ type: "err", text: "Add your Firecrawl API key in Config." });
      setShowConfig(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.firecrawlKey}`,
        },
        body: JSON.stringify({
          url: url.trim(),
          formats: [
            {
              type: "json",
              prompt:
                "Extract Amazon product info. Return keys: title (string), category (string, best breadcrumb category), price (number, current selling price in local currency, no symbols), mrp (number, original/list/MRP price, no symbols), image (string, absolute URL of main product image).",
            },
          ],
          onlyMainContent: true,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (body && (body.error || body.message)) ||
            `Firecrawl HTTP ${res.status}`,
        );
      }
      const j =
        body?.data?.json ?? body?.json ?? body?.data?.extract ?? body?.extract;
      if (!j) throw new Error("Firecrawl returned no structured data.");
      setScraped({
        title: String(j.title ?? ""),
        category: String(j.category ?? ""),
        price: j.price != null ? String(j.price) : "",
        mrp: j.mrp != null ? String(j.mrp) : "",
        image: String(j.image ?? ""),
        updated: formatISTTimestamp(new Date()),
      });
      setMsg({ type: "ok", text: "Fetched. Review & edit, then save." });
    } catch (e) {
      setMsg({ type: "err", text: `Fetch failed: ${(e as Error).message}` });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setMsg(null);
    if (!config.appsScriptUrl) {
      setMsg({
        type: "err",
        text: "Add your Google Apps Script Web App URL in Config.",
      });
      setShowConfig(true);
      return;
    }
    if (!config.spreadsheetId || !config.sheetTab) {
      setMsg({ type: "err", text: "Spreadsheet ID and Sheet 2 tab required." });
      setShowConfig(true);
      return;
    }
    if (!scraped.title) {
      setMsg({ type: "err", text: "Nothing to save — fetch a product first." });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        spreadsheetId: config.spreadsheetId,
        sheet: config.sheetTab,
        row: {
          standard_link: url.trim(),
          title: scraped.title,
          category: scraped.category,
          price: scraped.price,
          mrp: scraped.mrp,
          affiliate_link: "",
          image: scraped.image,
          Duplicate: "",
          updated: scraped.updated,
        },
      };
      // Use text/plain to avoid CORS preflight on Apps Script Web Apps.
      const res = await fetch(config.appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let ok = res.ok;
      let errText = text;
      try {
        const j = JSON.parse(text);
        if (j && typeof j.ok === "boolean") ok = j.ok;
        if (j && j.error) errText = j.error;
      } catch {}
      if (!ok) throw new Error(errText || `HTTP ${res.status}`);
      setMsg({ type: "ok", text: "Saved to Sheet 2 ✅" });
      setUrl("");
      setScraped(emptyScraped);
    } catch (e) {
      setMsg({ type: "err", text: `Save failed: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveToWebsite() {
    setMsg(null);
    if (!scraped.title || !scraped.price || !scraped.mrp) {
      setMsg({
        type: "err",
        text: "Nothing to publish — fetch a product first and confirm price + MRP.",
      });
      return;
    }
    const priceNum = Number(String(scraped.price).replace(/[^\d.]/g, ""));
    const mrpNum = Number(String(scraped.mrp).replace(/[^\d.]/g, ""));
    if (!priceNum || !mrpNum) {
      setMsg({ type: "err", text: "Price and MRP must be valid numbers." });
      return;
    }
    if (!url.trim()) {
      setMsg({ type: "err", text: "Amazon product URL is required." });
      return;
    }
    setPublishing(true);
    try {
      const affiliate = buildAmazonAffiliateLink(url.trim());
      const discount = calcDiscount(mrpNum, priceNum);
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("deals").insert({
        title: scraped.title,
        image: scraped.image || null,
        category: scraped.category || "General",
        price: priceNum,
        mrp: mrpNum,
        discount_percentage: discount,
        source: "Amazon",
        standard_link: url.trim(),
        affiliate_link: affiliate,
        coupon_code: null,
        hot_deal: discount > 65,
        is_active: true,
        created_by: userData.user?.id ?? null,
      });
      if (error) throw error;
      setMsg({
        type: "ok",
        text: "Published to website ✅ (live on the homepage now)",
      });
      setUrl("");
      setScraped(emptyScraped);
    } catch (e) {
      setMsg({
        type: "err",
        text: `Publish failed: ${(e as Error).message}`,
      });
    } finally {
      setPublishing(false);
    }
  }

  if (authState === "checking") {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">
        Checking access…
      </main>
    );
  }
  if (authState === "denied") {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-foreground">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account isn't an administrator.
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Sign out
        </button>
      </main>
    );
  }

  const inputCls =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-primary";
  const labelCls = "text-xs font-medium text-muted-foreground";

  return (
    <main className="mx-auto max-w-md px-4 py-6 pb-24">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mobile Admin</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Scrape an Amazon product, then publish to the website or append to Sheet 2.
          </p>
          {adminEmail && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Signed in as {adminEmail}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
        >
          Sign out
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-card p-3">
        <button
          type="button"
          onClick={() => setShowConfig((s) => !s)}
          className="flex w-full items-center justify-between text-sm font-semibold text-foreground"
        >
          <span>⚙️ Config</span>
          <span className="text-xs text-muted-foreground">
            {showConfig ? "hide" : "show"}
          </span>
        </button>
        {showConfig && (
          <div className="mt-3 space-y-3">
            <div>
              <label className={labelCls}>Firecrawl API Key</label>
              <input
                type="password"
                autoComplete="off"
                className={inputCls}
                value={config.firecrawlKey}
                onChange={(e) =>
                  saveConfig({ ...config, firecrawlKey: e.target.value })
                }
                placeholder="fc-..."
              />
            </div>
            <div>
              <label className={labelCls}>Google Spreadsheet ID</label>
              <input
                className={inputCls}
                value={config.spreadsheetId}
                onChange={(e) =>
                  saveConfig({ ...config, spreadsheetId: e.target.value })
                }
                placeholder="1AbC..."
              />
            </div>
            <div>
              <label className={labelCls}>Sheet 2 Tab Name</label>
              <input
                className={inputCls}
                value={config.sheetTab}
                onChange={(e) =>
                  saveConfig({ ...config, sheetTab: e.target.value })
                }
                placeholder="Sheet2"
              />
            </div>
            <div>
              <label className={labelCls}>
                Google Apps Script Web App URL
              </label>
              <input
                className={inputCls}
                value={config.appsScriptUrl}
                onChange={(e) =>
                  saveConfig({ ...config, appsScriptUrl: e.target.value })
                }
                placeholder="https://script.google.com/macros/s/.../exec"
              />
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                Required to write to Google Sheets. Deploy the script shown
                below once, then paste its Web App URL here.
              </p>
            </div>
            <details className="rounded border border-border bg-muted/40 p-2 text-[11px]">
              <summary className="cursor-pointer font-semibold">
                Apps Script code (copy into your sheet → Extensions → Apps Script → Deploy as Web App, "Anyone" access)
              </summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-snug">{`function doPost(e){
  try{
    var p = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(p.spreadsheetId);
    var sh = ss.getSheetByName(p.sheet);
    if(!sh) throw new Error('Sheet not found: '+p.sheet);
    var headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
    if(!headers || headers.length===0 || !headers[0]){
      headers = ['standard_link','title','category','price','mrp','affiliate_link','image','Duplicate','updated'];
      sh.getRange(1,1,1,headers.length).setValues([headers]);
    }
    var row = headers.map(function(h){ return p.row[h] !== undefined ? p.row[h] : ''; });
    sh.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
  }catch(err){
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(err)})).setMimeType(ContentService.MimeType.JSON);
  }
}`}</pre>
            </details>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <label className={labelCls}>Amazon Product URL</label>
        <input
          type="url"
          inputMode="url"
          className={inputCls}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.amazon.in/dp/..."
        />
        <button
          type="button"
          onClick={handleFetch}
          disabled={loading}
          className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Fetching…" : "Fetch Product"}
        </button>
      </div>

      {msg && (
        <div
          className={`mt-4 rounded-md border p-2 text-sm ${
            msg.type === "ok"
              ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300"
              : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {(
          [
            ["title", "Title"],
            ["category", "Category"],
            ["price", "Price"],
            ["mrp", "MRP"],
            ["image", "Image URL"],
            ["updated", "Updated"],
          ] as [keyof Scraped, string][]
        ).map(([k, label]) => (
          <div key={k}>
            <label className={labelCls}>{label}</label>
            <input
              className={`${inputCls} ${k === "updated" ? "bg-muted/60 text-muted-foreground" : ""}`}
              value={scraped[k]}
              readOnly={k === "updated"}
              onChange={(e) =>
                setScraped({ ...scraped, [k]: e.target.value })
              }
            />
          </div>
        ))}

        {scraped.image && (
          <img
            src={scraped.image}
            alt="preview"
            className="mx-auto max-h-48 rounded border border-border object-contain"
          />
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-md bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save to Google Sheet"}
        </button>
      </div>
    </main>
  );
}
