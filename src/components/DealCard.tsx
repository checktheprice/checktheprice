import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Flame, TrendingDown } from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
import {
  type Deal,
  calcDiscount,
  isValidAffiliateLink,
  localShopPrice,
  lootLevel,
} from "@/lib/deals";

interface Props {
  deal: Deal;
  onAlert: (deal: Deal) => void;
}

export function DealCard({ deal, onAlert }: Props) {
  const discount = calcDiscount(deal.mrp, deal.onlinePrice);
  const localPrice = localShopPrice(deal.mrp);
  const savings = localPrice - deal.onlinePrice;
  const level = lootLevel(discount);
  const linkOk = isValidAffiliateLink(deal.affiliateLink);

  const openLink = () => {
    if (!linkOk) return;
    window.open(deal.affiliateLink, "_blank", "noopener,noreferrer");
  };

  const levelBadge =
    level === "hot"
      ? { class: "bg-red-50 text-red-600", icon: true }
      : level === "mid"
        ? { class: "bg-amber-50 text-amber-600", icon: false }
        : { class: "bg-slate-50 text-slate-500", icon: false };

  return (
    <div
      className={`group flex w-full gap-3 rounded-xl border bg-white p-3 shadow-sm transition-shadow duration-200 hover:shadow-md ${
        linkOk ? "cursor-pointer" : ""
      }`}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("a,button")) return;
        openLink();
      }}
      role={linkOk ? "link" : undefined}
      tabIndex={linkOk ? 0 : undefined}
      onKeyDown={(e) => {
        if (!linkOk) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openLink();
        }
      }}
    >
      {/* Image - Left */}
      <div className="shrink-0">
        <img
          src={deal.image}
          alt={deal.title}
          loading="lazy"
          className="h-[100px] w-[100px] rounded-lg object-contain"
        />
      </div>

      {/* Content - Right */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-[16px] font-bold leading-snug text-foreground">
              {deal.title}
            </h3>
            {level === "hot" && (
              <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">
                {discount}% OFF
              </span>
            )}
          </div>
          <Badge
            variant="outline"
            className="mt-1.5 text-[12px] font-normal text-muted-foreground"
          >
            {deal.category}
          </Badge>
        </div>

        {/* Prices */}
        <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
          <span className="text-[18px] font-extrabold text-foreground">
            ₹{deal.onlinePrice.toLocaleString()}
          </span>
          <span className="text-[13px] line-through text-muted-foreground">
            ₹{deal.mrp.toLocaleString()}
          </span>
          <span className="rounded bg-green-50 px-1.5 py-0.5 text-[12px] font-semibold text-green-600">
            Save ₹{savings.toLocaleString()}
          </span>
        </div>

        {/* Button */}
        <div className="mt-2 flex items-center gap-2">
          {linkOk ? (
            <a
              href={deal.affiliateLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#ff9900] px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-[#e8890a]"
            >
              Grab Deal <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <Button size="sm" disabled className="rounded-lg text-[13px]">
              Unavailable
            </Button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAlert(deal);
            }}
            className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Set price drop alert"
          >
            Alert
          </button>
          <ShareButton deal={deal} />
        </div>
      </div>
    </div>
  );
}
