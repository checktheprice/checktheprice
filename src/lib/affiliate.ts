export const AMAZON_AFFILIATE_TAG = "pavani15-21";

/**
 * Build an Amazon India affiliate link that always uses AMAZON_AFFILIATE_TAG.
 * Strips any existing tag/associate params from the URL first.
 * Returns the original string unchanged if it isn't a parseable Amazon URL.
 */
export function buildAmazonAffiliateLink(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  const trimmed = rawUrl.trim();
  try {
    const u = new URL(trimmed);
    if (!/(^|\.)amazon\./i.test(u.hostname)) return trimmed;
    // Remove existing affiliate/associate params
    ["tag", "ascsubtag", "linkCode", "ref_", "th"].forEach((p) => u.searchParams.delete(p));
    u.searchParams.set("tag", AMAZON_AFFILIATE_TAG);
    return u.toString();
  } catch {
    return trimmed;
  }
}
