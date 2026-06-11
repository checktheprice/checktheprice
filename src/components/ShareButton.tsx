import { useState } from "react";
import { Share2, Copy, X, Check } from "lucide-react";
import type { Deal } from "@/lib/deals";

interface Props {
  deal: Deal;
}

export function ShareButton({ deal }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const pageUrl =
    typeof window !== "undefined" ? window.location.href : "";
  const text = `🔥 ${deal.title} — ₹${deal.onlinePrice.toLocaleString()} (MRP ₹${deal.mrp.toLocaleString()})\n${deal.affiliateLink}\nMore deals: ${pageUrl}`;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: deal.title,
          text,
          url: deal.affiliateLink,
        });
        return;
      } catch {
        /* fallback to modal */
      }
    }
    setOpen(true);
  };

  const encoded = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(deal.affiliateLink);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="inline-flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted"
        aria-label="Share this deal"
      >
        <Share2 className="h-3.5 w-3.5" />
        Share
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground">
                Share this deal
              </h4>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <a
                href={`https://wa.me/?text=${encoded}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 rounded-lg bg-[#25D366]/10 p-3 text-xs font-semibold text-[#128C7E] hover:bg-[#25D366]/20"
              >
                <span className="text-lg">💬</span>
                WhatsApp
              </a>
              <a
                href={`https://t.me/share/url?url=${encodedUrl}&text=${encoded}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 rounded-lg bg-sky-50 p-3 text-xs font-semibold text-sky-700 hover:bg-sky-100"
              >
                <span className="text-lg">✈️</span>
                Telegram
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encoded}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 rounded-lg bg-blue-50 p-3 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                <span className="text-lg">📘</span>
                Facebook
              </a>
            </div>

            <button
              onClick={copy}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-600" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copy deal link
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}