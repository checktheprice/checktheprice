/**
 * Strict, rule-based product matching for the price comparison feature.
 * Pure functions, no AI, no network calls — it only inspects the titles that
 * the comparison engine already returned.
 */

/** Words that mean "this is an accessory / not the product itself". */
const ACCESSORY_TERMS = [
  "case", "cases", "cover", "covers", "back cover", "flip cover", "pouch",
  "sleeve", "skin", "sticker", "tempered glass", "screen guard", "screen protector",
  "protector", "guard", "charger", "charging cable", "cable", "adapter", "adaptor",
  "power bank", "stand", "holder", "mount", "tripod", "strap", "band only", "lens",
  "filter", "bumper", "grip", "housing", "battery", "spare", "refill", "combo pack of",
  "accessory", "accessories",
];

/** Words that mean "made for" some other product. */
const COMPATIBILITY_TERMS = [
  "compatible", "compatible with", "suitable for", "designed for", "replacement",
  "refurbished", "renewed", "used", "open box", "for use with",
];

const COLORS = [
  "black", "white", "blue", "red", "green", "silver", "gold", "grey", "gray", "graphite",
  "midnight", "starlight", "purple", "violet", "pink", "yellow", "orange", "brown", "beige",
  "cream", "titanium", "bronze", "copper", "navy", "teal", "lavender", "mint",
];

const STOPWORDS = new Set([
  "the", "and", "with", "for", "new", "latest", "buy", "online", "price", "in", "india", "of",
  "at", "best", "offer", "deal", "free", "delivery", "smartphone", "mobile", "phone", "model",
  "edition", "official", "genuine", "original", "pack",
]);

export function normalizeTitle(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/[|(){}\[\],:;!?"'`’]/g, " ")
    .replace(/[-_/+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(norm: string): string[] {
  return norm.split(" ").filter((t) => t.length > 0);
}

function meaningfulTokens(norm: string): string[] {
  return tokens(norm).filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

const UNIT_WORD_RE =
  /^(gb|tb|mb|ml|ltr|litre|liters?|litres?|l|kg|gm|g|inch|inches|in|cm|mm|ton|watts?|w|mah|mp|hz|seater|kwh)$/;

function variantValues(norm: string): string[] {
  const out = new Set<string>();
  const unitRe =
    /(\d+(?:\.\d+)?)\s?(gb|tb|mb|ml|ltr|litre|litres|liters?|l|kg|gm|g|inch|inches|in|cm|mm|ton|watts?|w|mah|mp|hz|seater|kwh)\b/g;
  let m: RegExpExecArray | null;
  while ((m = unitRe.exec(norm))) {
    let unit = m[2];
    if (unit === "inches" || unit === "in") unit = "inch";
    if (["litre", "litres", "liters", "liter", "ltr"].includes(unit)) unit = "l";
    if (unit === "gm") unit = "g";
    if (unit === "watt" || unit === "watts") unit = "w";
    out.add(`${Number(m[1])}${unit}`);
  }
  return [...out];
}

function colorValues(norm: string): string[] {
  const t = new Set(tokens(norm));
  return COLORS.filter((c) => t.has(c));
}

function modelTokens(norm: string): string[] {
  const skip = new Set(variantValues(norm));
  const all = tokens(norm);
  return all.filter((t, i) => {
    if (STOPWORDS.has(t)) return false;
    if (/^\d+(\.\d+)?(gb|tb|mb|ml|l|kg|g|inch|cm|mm|w|mah|mp|hz)$/.test(t)) return false;
    if (skip.has(t)) return false;
    if (/^\d+x$/.test(t)) return false;
    if (/^\d+(\.\d+)?$/.test(t) && i + 1 < all.length && UNIT_WORD_RE.test(all[i + 1])) return false;
    return /\d/.test(t) && t.length <= 12;
  });
}

export type ProductSignature = {
  norm: string;
  brand: string | null;
  models: string[];
  variants: string[];
  colors: string[];
  words: string[];
};

function mainClause(rawTitle: string): string {
  return (rawTitle ?? "")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .split(/[|,;:]/)[0]
    .split(/\bfor\b/i)[0]
    .trim();
}

function isSpecToken(t: string): boolean {
  return /^\d+(\.\d+)*$/.test(t) || /^\d+(\.\d+)?[a-z]+$/.test(t) || UNIT_WORD_RE.test(t);
}

export function buildSignature(title: string): ProductSignature {
  const norm = normalizeTitle(title);
  const mainNorm = normalizeTitle(mainClause(title));
  const mainWords = meaningfulTokens(mainNorm);
  const useMain = mainWords.length >= 2;
  const allWords = useMain ? mainWords : meaningfulTokens(norm);
  return {
    norm,
    brand: allWords[0] ?? null,
    models: modelTokens(useMain ? mainNorm : norm),
    variants: variantValues(norm),
    colors: colorValues(norm),
    words: allWords.filter((w) => !isSpecToken(w)),
  };
}

function hasAny(norm: string, terms: string[]): boolean {
  return terms.some((t) => (t.includes(" ") ? norm.includes(t) : tokens(norm).includes(t)));
}

/**
 * Generic/category queries have no model/generation/size identifiers. They
 * should not be treated as a single exact product: for example "VR headset"
 * should return relevant VR headsets from multiple merchants.
 */
export function isGenericSearch(reference: ProductSignature): boolean {
  return reference.models.length === 0 && reference.variants.length === 0;
}

/**
 * Match a category query without requiring the first query word to be a brand.
 * Accessory and compatibility exclusions remain active so cases, chargers,
 * stands, replacement and used listings do not pollute category results.
 */
export function isRelevantCategoryProduct(
  reference: ProductSignature,
  candidateTitle: string,
): boolean {
  const cand = buildSignature(candidateTitle);
  if (!cand.norm) return false;

  if (!hasAny(reference.norm, ACCESSORY_TERMS) && hasAny(cand.norm, ACCESSORY_TERMS)) return false;
  if (!hasAny(reference.norm, COMPATIBILITY_TERMS) && hasAny(cand.norm, COMPATIBILITY_TERMS)) return false;

  const queryWords = reference.words;
  const candidateWords = new Set(meaningfulTokens(cand.norm));
  if (queryWords.length === 0) return false;

  const overlap = queryWords.filter((word) => candidateWords.has(word)).length;
  const ratio = overlap / queryWords.length;

  // Short category queries such as "vr headset" need at least one category
  // term to survive, while 3+ word queries need half of their terms.
  return queryWords.length <= 2 ? overlap >= 1 : ratio >= 0.5;
}

/** Decide whether a candidate offer title is the SAME product as the reference. */
export function isSameProduct(reference: ProductSignature, candidateTitle: string): boolean {
  const cand = buildSignature(candidateTitle);
  if (!cand.norm) return false;

  const refAccessory = hasAny(reference.norm, ACCESSORY_TERMS);
  if (!refAccessory && hasAny(cand.norm, ACCESSORY_TERMS)) return false;
  if (!hasAny(reference.norm, COMPATIBILITY_TERMS) && hasAny(cand.norm, COMPATIBILITY_TERMS)) return false;

  if (reference.brand && !cand.norm.includes(reference.brand)) return false;
  for (const m of reference.models) {
    if (!tokens(cand.norm).includes(m)) return false;
  }
  for (const v of reference.variants) {
    if (!cand.variants.includes(v)) return false;
  }
  if (reference.colors.length > 0 && cand.colors.length > 0) {
    const shared = reference.colors.some((c) => cand.colors.includes(c));
    if (!shared) return false;
  }
  if (reference.words.length >= 2) {
    const candSet = new Set(meaningfulTokens(cand.norm));
    const overlap = reference.words.filter((w) => candSet.has(w)).length;
    if (overlap / reference.words.length < 0.55) return false;
  }
  return true;
}
