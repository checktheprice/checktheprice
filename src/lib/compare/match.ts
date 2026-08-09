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

/** Capacity / size style variants: 128gb, 8 gb, 1tb, 55 inch, 1.5 ton, 500ml. */
function variantValues(norm: string): string[] {
  const out = new Set<string>();
  const unitRe =
    /(\d+(?:\.\d+)?)\s?(gb|tb|mb|ml|ltr|litre|liters?|l|kg|gm|g|inch|inches|in|cm|mm|ton|watt|w|mah|mp|hz|seater|kwh)\b/g;
  let m: RegExpExecArray | null;
  while ((m = unitRe.exec(norm))) {
    let unit = m[2];
    if (unit === "inches" || unit === "in") unit = "inch";
    if (unit === "litre" || unit === "liters" || unit === "liter" || unit === "ltr") unit = "l";
    if (unit === "gm") unit = "g";
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
  return tokens(norm).filter((t) => {
    if (STOPWORDS.has(t)) return false;
    if (/^\d+(\.\d+)?(gb|tb|mb|ml|l|kg|g|inch|cm|mm|w|mah|mp|hz)$/.test(t)) return false;
    if (skip.has(t)) return false;
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

export function buildSignature(title: string): ProductSignature {
  const norm = normalizeTitle(title);
  const words = meaningfulTokens(norm);
  return {
    norm,
    brand: words[0] ?? null,
    models: modelTokens(norm),
    variants: variantValues(norm),
    colors: colorValues(norm),
    words,
  };
}

/**
 * Marketing/filler words (beyond STOPWORDS) that never help cross-store
 * discovery. Used only by buildCompareQuery — the matcher is unaffected.
 */
const MARKETING_TERMS = new Set([
  "premium",
  "imported",
  "exclusive",
  "branded",
  "stylish",
  "special",
  "limited",
  "super",
  "sale",
  "combo",
  "warranty",
  "guarantee",
  "assured",
  "certified",
  "bestseller",
  "bestselling",
  "trending",
  "upto",
]);

/** Unit words that must stay attached to a preceding bare number ("725 Watts"). */
const UNIT_WORDS = new Set([
  "w",
  "watt",
  "watts",
  "gb",
  "tb",
  "mb",
  "ml",
  "l",
  "ltr",
  "litre",
  "litres",
  "liter",
  "liters",
  "kg",
  "g",
  "gm",
  "inch",
  "inches",
  "cm",
  "mm",
  "ton",
  "mah",
  "mp",
  "hz",
  "channel",
  "seater",
  "kwh",
]);

/** Max descriptive (non-numeric) words kept in the provider query. */
const QUERY_MAX_WORDS = 8;

/**
 * Build a SHORT, cross-store-friendly search query from a scraped product
 * title: brand + product/model name + numeric specs (wattage, capacity,
 * size, generation), with marketing filler and trailing "with/without …"
 * qualifiers dropped. Case is preserved for display. Returns "" when the
 * title yields too little signal — callers should fall back to the raw title.
 *
 * The strict matcher stays the sole judge of whether a returned candidate is
 * the same product; this only widens provider recall.
 */
export function buildCompareQuery(rawTitle: string): string {
  // Clause 0 (before the first comma/parenthesis/pipe) carries the product
  // name; later clauses are variant/feature lists that only contribute
  // unit-bearing specs ("725 Watts", "8GB", "5.2.4 Channel").
  const clauses = (rawTitle ?? "")
    .replace(/["'`’]/g, "")
    .split(/[|(){}[\],:;!?]+/)
    .map((c) =>
      c
        .replace(/[-_/+]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  if (clauses.length === 0) return "";

  const kept: string[] = [];
  const seenNumeric = new Set<string>();

  const pushNumeric = (tok: string): boolean => {
    const norm = tok.toLowerCase();
    if (seenNumeric.has(norm)) return false;
    seenNumeric.add(norm);
    kept.push(tok);
    return true;
  };

  // --- Main clause: brand + product/model name + inline specs. ---
  let descriptiveDone = false;
  let prevKept = "";
  let prevBareNumber = false;
  for (const tok of clauses[0].split(" ")) {
    const norm = tok.toLowerCase();

    // "with/without …" starts a qualifier ("Without Cable"): stop collecting
    // descriptive words, but keep any numeric specs that still follow.
    if (norm === "with" || norm === "without") {
      descriptiveDone = true;
      prevBareNumber = false;
      continue;
    }
    if (/\d/.test(norm)) {
      prevBareNumber = pushNumeric(tok) && /^\d+(\.\d+)*$/.test(norm);
      continue;
    }
    if (prevBareNumber && UNIT_WORDS.has(norm)) {
      kept.push(tok); // keep the unit glued to its number: "725 Watts"
      prevBareNumber = false;
      continue;
    }
    prevBareNumber = false;
    if (descriptiveDone || STOPWORDS.has(norm) || MARKETING_TERMS.has(norm)) {
      continue;
    }
    // Single letters survive only as uppercase suffixes: "Type C", "DTS X".
    if (norm.length === 1 && !(tok === tok.toUpperCase() && prevKept !== "")) {
      continue;
    }
    if (kept.filter((k) => !/\d/.test(k)).length < QUERY_MAX_WORDS) {
      kept.push(tok);
      prevKept = tok;
    }
  }

  // --- Later clauses: unit-bearing specs only. ---
  for (const clause of clauses.slice(1)) {
    const toks = clause.split(" ");
    for (let i = 0; i < toks.length; i++) {
      const norm = toks[i].toLowerCase();
      // "8GB", "25W", "1.5Ton" — number fused with its unit.
      if (/^\d+(\.\d+)*[a-z]+$/.test(norm)) {
        pushNumeric(toks[i]);
        continue;
      }
      // "725 Watts", "5.2.4 Channel" — bare number followed by a unit word.
      if (
        /^\d+(\.\d+)*$/.test(norm) &&
        i + 1 < toks.length &&
        UNIT_WORDS.has(toks[i + 1].toLowerCase())
      ) {
        if (pushNumeric(toks[i])) kept.push(toks[i + 1]);
        i++;
      }
    }
  }

  return kept.length >= 2 ? kept.join(" ") : "";
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

  // 6. General wording overlap keeps the category the same.
  if (reference.words.length >= 2) {
    const candSet = new Set(cand.words);
    const overlap = reference.words.filter((w) => candSet.has(w)).length;
    if (overlap / reference.words.length < 0.55) return false;
  }

  return true;
}
