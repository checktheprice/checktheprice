import { MARKETPLACES, type Marketplace } from "@/lib/marketplace";

export interface MarketplaceLogoProps {
  marketplace: Marketplace;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-5",   // 20px
  md: "h-6",   // 24px
  lg: "h-8",   // 32px
} as const;

/**
 * Renders the official marketplace logo for a given marketplace.
 * Returns null for "other" so no broken image is shown.
 *
 * Usage:
 *   <MarketplaceLogo marketplace="amazon" size="sm" />
 */
export function MarketplaceLogo({
  marketplace,
  size = "sm",
  className = "",
}: MarketplaceLogoProps) {
  if (marketplace === "other") return null;

  const config = MARKETPLACES[marketplace];
  if (!config) return null;

  return (
    <img
      src={config.logo}
      alt={`${config.name} logo`}
      aria-label={`${config.name} logo`}
      loading="lazy"
      className={`${sizeMap[size]} w-auto object-contain ${className}`}
    />
  );
}
