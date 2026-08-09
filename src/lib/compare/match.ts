/**
 * Strict, rule-based product matching for the price comparison feature.
 * Pure functions, no AI, no network calls — it only inspects the titles that
 * the comparison engine already returned.
 */

/** Words that mean "this is an accessory / not the product itself". */
const ACCESSORY_TERMS = [
  "case",
  "cases",
  "cover",
  "covers",
  "back cover",
  "flip cover",
  "pouch",
  "sleeve",
  "skin",
  "sticker",
  "tempered glass",
  "screen guard",
  "screen protector",
  "protector",
  "guard",
  "charger",
  "charging cable",
  "cable",
  "adapter",
  "adaptor",
  "power bank",
  "stand",
  "holder",
  "mount",
  "tripod",
  "strap",
  "band only",
  "lens",
  "filter",
  "bumper",
  "grip",
  "housing",
  "battery",
  "spare",
  "refill",
  "combo pack of",
  "accessory",
  "accessories",
];

/** Words that mean "made for" some other product. */
const COMPATIBILITY_TERMS = [
  "compatible",
  "compatible with",
  "suitable for",
  "designed for",
  "replacement",
  "refurbished",
  "renewed",
  "used",
  "open box",
  "for use with",
];

const COLORS = [
  "black",
  "white",
  "blue",
  "red",
  "green",
  "silver",
  "gold",
  "grey",
  "gray",
  "graphite",
  "midnight",
  "starlight",
  "purple",
  "violet",
  "pink",
  "yellow",
  "orange",
  "brown",
  "beige",
  "cream",
  "titanium",
  "bronze",
  "copper",
  "navy",
  "teal",
  "lavender",
  "mint",
];

const STOPWORDS = new Set([
  "the",
  "and",
  "with",
  "for",
  "new",
  "latest",
  "buy",
  "online",
  "price",
  "in",
  "india",
  "of",
  "at",
  "best",
  "offer",
  "deal",
  "free",
  "delivery",
  "smartphone",
  "mobile",
  "phone",
  "model",
  "edition",
  "official",
  "genuine",
  "original",
  "pack",
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

/** Unit words that may follow a bare number ("725 Watts", "55 inch"). */
const UNIT_WORD_RE =
  /^(gb|tb|mb|ml|ltr|litre|liters?|litres?|l|kg|gm|g|inch|inches|in|cm|mm|ton|watts?|w|mah|mp|hz|seater|kwh)$/;

/** Capacity / size style variants: 128gb, 8 gb, 1tb, 55 inch, 1.5 ton, 500ml. */
function variantValues(norm: string): string[] {
  const out = new Set<string>();
  // "watts?" (plural included) so "725 Watts", "725 Watt" and "725 W" all
  // normalize to the same variant value.
  const unitRe =
    /(\d+(?:\.\d+)?)\s?(gb|tb|mb|ml|ltr|litre|litres|liters?|l|kg|gm|g|inch|inches|in|cm|mm|ton|watts?|w|mah|mp|hz|seater|kwh)\b/g;
  let m: RegExpExecArray | null;
  while ((m = unitRe.exec(norm))) {
    let unit = m[2];
    if (unit === "inches" || unit === "in") unit = "inch";
    if (
      unit === "litre" ||
      unit === "litres" ||
      unit === "liters" ||
      unit === "liter" ||
      unit === "ltr"
    )
      unit = "l";
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

/** Tokens that identify a specific model / generation, e.g. "s24", "15", "pro". */
function modelTokens(norm: string): string[] {
  const skip = new Set(variantValues(norm));
  const all = tokens(norm);
  return all.filter((t, i) => {
    if (STOPWORDS.has(t)) return false;
    if (/^\d+(\.\d+)?(gb|tb|mb|ml|l|kg|g|inch|cm|mm|w|mah|mp|hz)$/.test(t)) return false;
    if (skip.has(t)) return false;
    // Multiplier feature tokens ("2x Subwoofer") are not model identifiers.
    if (/^\d+x$/.test(t)) return false;
    // A bare number followed by its unit word is a spec ("725 Watts"),
    // already captured by variantValues — not a mandatory model token.
    if (/^\d+(\.\d+)?$/.test(t) && i + 1 < all.length && UNIT_WORD_RE.test(all[i + 1]))
      return false;
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

/**
 * The MAIN product clause of a raw title: everything before the first
 * comma/pipe/semicolon/colon, with parenthetical/bracketed asides removed and
 * "for …" compatibility tails ("for Galaxy S10/M54/M55/A80") cut off. This is
 * where the brand and the genuine model name live; later clauses are feature
 * lists and compatibility text that must not produce mandatory identifiers.
 */
function mainClause(rawTitle: string): string {
  return (rawTitle ?? "")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .split(/[|,;:]/)[0]
    .split(/\bfor\b/i)[0]
    .trim();
}

/**
 * Spec-style tokens (pure numbers, fused number+unit, unit words) are kept
 * out of the Rule 6 overlap words: variants are already enforced exactly by
 * Rule 4 and numeric model identifiers by Rule 3, so counting them again in
 * word overlap only penalizes spelling differences ("725W" vs "725 Watt").
 */
function isSpecToken(t: string): boolean {
  return /^\d+(\.\d+)*$/.test(t) || /^\d+(\.\d+)?[a-z]+$/.test(t) || UNIT_WORD_RE.test(t);
}

export function buildSignature(title: string): ProductSignature {
  const norm = normalizeTitle(title);
  // Model tokens and overlap words come from the main clause only, so
  // compatibility lists and feature clauses can't pollute the reference
  // signature. Variants and colors stay strict (harvested from the FULL
  // title). Falls back to the full title when the main clause is too thin.
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
 * Decide whether a candidate offer title is the SAME product as the reference.
 * Strict by design: brand, model, category-ish wording and variant must agree,
 * and accessories / compatible / replacement listings are always rejected.
 */
export function isSameProduct(reference: ProductSignature, candidateTitle: string): boolean {
  const cand = buildSignature(candidateTitle);
  if (!cand.norm) return false;

  // 1. Accessory / compatibility exclusions (unless the reference itself is one).
  const refAccessory = hasAny(reference.norm, ACCESSORY_TERMS);
  if (!refAccessory && hasAny(cand.norm, ACCESSORY_TERMS)) return false;
  if (!hasAny(reference.norm, COMPATIBILITY_TERMS) && hasAny(cand.norm, COMPATIBILITY_TERMS)) {
    return false;
  }

  // 2. Brand must appear somewhere in the candidate title.
  if (reference.brand && !cand.norm.includes(reference.brand)) return false;

  // 3. Every model / generation token of the reference must be present.
  for (const m of reference.models) {
    if (!tokens(cand.norm).includes(m)) return false;
  }

  // 4. Variants (RAM, storage, capacity, size) must all match when known.
  for (const v of reference.variants) {
    if (!cand.variants.includes(v)) return false;
  }

  // 5. Colour, when the reference states one, must match.
  if (reference.colors.length > 0 && cand.colors.length > 0) {
    const shared = reference.colors.some((c) => cand.colors.includes(c));
    if (!shared) return false;
  }

  // 6. General wording overlap keeps the category the same. The reference
  // words come from its main clause; the candidate side uses its FULL title
  // so reference words are found wherever the other store placed them.
  if (reference.words.length >= 2) {
    const candSet = new Set(meaningfulTokens(cand.norm));
    const overlap = reference.words.filter((w) => candSet.has(w)).length;
    if (overlap / reference.words.length < 0.55) return false;
  }

  return true;
}
