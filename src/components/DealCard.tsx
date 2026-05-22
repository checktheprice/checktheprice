import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, ExternalLink, Flame, TrendingDown } from "lucide-react";
import {
  type Deal,
  calcDiscount,
  localShopPrice,
  lootLevel,
} from "@/lib/deals";

interface Props {
  deal: Deal;
  onAlert: (deal: Deal) => void;
}

const lootStyles = {
  hot: {
    bar: "bg-loot-hot",
    text: "text-loot-hot",
    label: "🔥 HOT LOOT",
    width: "100%",
  },
  mid: {
    bar: "bg-loot-mid",
    text: "text-loot-mid",
    label: "⚡ Good Deal",
    width: "66%",
  },
  low: {
    bar: "bg-loot-low",
    text: "text-loot-low",
    label: "Decent",
    width: "33%",
  },
} as const;

export function DealCard({ deal, onAlert }: Props) {
  const discount = calcDiscount(deal.mrp, deal.onlinePrice);
  const localPrice = localShopPrice(deal.mrp);
  const savings = localPrice - deal.onlinePrice;
  const level = lootLevel(discount);
  const style = lootStyles[level];

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "var(--gradient-card)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={deal.image}
          alt={deal.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <Badge className="absolute left-3 top-3 bg-background/90 text-foreground backdrop-blur">
          {deal.category}
        </Badge>
        {level === "hot" && (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-loot-hot px-2.5 py-1 text-xs font-bold text-white shadow-lg">
            <Flame className="h-3 w-3" /> {discount}% OFF
          </div>
        )}
        {level !== "hot" && (
          <div className="absolute right-3 top-3 rounded-full bg-foreground/90 px-2.5 py-1 text-xs font-bold text-background">
            {discount}% OFF
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 min-h-[2.75rem] text-sm font-semibold leading-snug">
          {deal.title}
        </h3>

        {/* Loot Meter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wide text-muted-foreground">
              Loot Meter
            </span>
            <span className={`font-bold ${style.text}`}>{style.label}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full ${style.bar} transition-all duration-700`}
              style={{ width: style.width }}
            />
          </div>
        </div>

        {/* Pricing */}
        <div className="space-y-2 rounded-xl bg-secondary/60 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Online price</span>
            <span className="text-xl font-bold text-foreground">
              ₹{deal.onlinePrice.toLocaleString()}
            </span>
          </div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">MRP</span>
            <span className="line-through text-muted-foreground">
              ₹{deal.mrp.toLocaleString()}
            </span>
          </div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">
              Approx. local shop price
            </span>
            <span className="font-medium">
              ₹{localPrice.toLocaleString()}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-2">
            <span className="flex items-center gap-1 text-xs font-medium text-loot-hot">
              <TrendingDown className="h-3.5 w-3.5" /> Total savings
            </span>
            <span className="text-base font-bold text-loot-hot">
              ₹{savings.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="mt-auto flex gap-2 pt-1">
          <Button asChild className="flex-1" size="sm">
            <a
              href={deal.affiliateLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              Grab Deal <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAlert(deal)}
            aria-label="Set price drop alert"
          >
            <Bell className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}