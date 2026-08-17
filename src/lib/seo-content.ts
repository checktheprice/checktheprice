// Product-page content generator.
// Important rule: content must be derived from the product title/category facts.
// It must never fill missing product facts with unrelated category claims.

export interface DealSeoContent {
  metaDescription: string;
  description: string;
  features: string[];
  benefits: string[];
  whoShouldBuy: string;
  buyingTips: string[];
  faqs: { q: string; a: string }[];
}

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, values: T[]): T | undefined {
  return values.length ? values[Math.floor(r() * values.length)] : undefined;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
}

function joinList(values: string[]): string {
  const items = values.filter(Boolean);
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

interface ProductFacts {
  title: string;
  productType: string;
  noun: string;
  material?: string;
  size?: string;
  dimensions?: string;
  pack?: string;
  audience?: string;
  attributes: string[];
  uses: string[];
  facts: string[];
}

// These are recognition hints, not content templates. New products fall back
// to their actual title instead of being forced into an unrelated category.
const PRODUCT_HINTS: Array<{ re: RegExp; type: string; noun: string }> = [
  { re: /pooja\s+mandir|pooja\s+temple|puja\s+mandir|puja\s+temple|wooden\s+temple/i, type: "pooja mandir", noun: "mandir" },
  { re: /headphones?|earbuds?|earphones?/i, type: "audio product", noun: "audio product" },
  { re: /smartwatch|fitness\s+band|smart\s+band/i, type: "wearable", noun: "wearable" },
  { re: /laptop|notebook/i, type: "laptop", noun: "laptop" },
  { re: /tablet|ipad/i, type: "tablet", noun: "tablet" },
  { re: /smartphone|mobile\s+phone|phone\b/i, type: "smartphone", noun: "phone" },
  { re: /charger|power\s+adapter/i, type: "charger", noun: "charger" },
  { re: /power\s*bank/i, type: "power bank", noun: "power bank" },
  { re: /mixer\s+grinder|mixie/i, type: "mixer grinder", noun: "mixer grinder" },
  { re: /electric\s+kettle|kettle/i, type: "electric kettle", noun: "kettle" },
  { re: /pressure\s+cooker|cooker\b/i, type: "pressure cooker", noun: "cooker" },
  { re: /t-?shirt|shirt\b/i, type: "clothing item", noun: "clothing item" },
  { re: /jeans?|trousers?|pants?|chinos?/i, type: "bottomwear", noun: "bottomwear" },
  { re: /shoes?|sneakers?|sandals?|slippers?/i, type: "footwear", noun: "footwear" },
  { re: /pillow|cushion|bedsheet|blanket|comforter|mattress/i, type: "home furnishing", noun: "home furnishing" },
  { re: /lamp|ceiling\s+light|table\s+lamp|bulb/i, type: "lighting product", noun: "lighting product" },
  { re: /trimmer|shaver|epilator|hair\s+dryer/i, type: "grooming product", noun: "grooming product" },
  { re: /toy|puzzle|lego|board\s+game/i, type: "toy or game", noun: "toy or game" },
  { re: /book|novel|guide\b/i, type: "book", noun: "book" },
];

const MATERIALS = [
  "wooden", "wood", "bamboo", "metal", "stainless steel", "steel", "aluminium", "plastic",
  "glass", "ceramic", "cotton", "leather", "silicone", "rubber", "fabric", "acrylic",
];

const ATTRIBUTE_PATTERNS: Array<[RegExp, string]> = [
  [/led\s+light|led/i, "LED light"],
  [/drawer/i, "drawer"],
  [/shelves?|shelf/i, "shelves"],
  [/wall\s*mounted|wall\s+mount/i, "wall mounted"],
  [/tabletop|table\s*top/i, "tabletop"],
  [/foldable|folding/i, "foldable"],
  [/adjustable/i, "adjustable"],
  [/portable/i, "portable"],
  [/compact/i, "compact"],
  [/rechargeable/i, "rechargeable"],
  [/wireless/i, "wireless"],
  [/bluetooth/i, "Bluetooth"],
  [/waterproof/i, "waterproof"],
  [/water[- ]?resistant/i, "water resistant"],
  [/non[- ]?stick/i, "non-stick"],
  [/diy|do\s*it\s*yourself/i, "DIY assembly"],
  [/om\s+logo/i, "OM logo"],
  [/fast\s+charg/i, "fast charging"],
  [/noise[- ]?cancel/i, "noise cancellation"],
];

function analyzeTitle(title: string, category: string): ProductFacts {
  const t = clean(title);
  const low = t.toLowerCase();
  const hint = PRODUCT_HINTS.find((item) => item.re.test(low));

  const dimensionMatch = low.match(/(?:h\s*-?\s*)?(\d+(?:\.\d+)?)\s*[x×]\s*(?:l\s*-?\s*)?(\d+(?:\.\d+)?)\s*[x×]\s*(?:w\s*-?\s*)?(\d+(?:\.\d+)?)\s*(?:inch|inches|in)\b/i);
  const simpleSize = low.match(/(\d+(?:\.\d+)?)\s*(inch|inches|in|cm|mm)\b/i);
  const dimensions = dimensionMatch
    ? `${dimensionMatch[1]} × ${dimensionMatch[2]} × ${dimensionMatch[3]} ${/inch|inches|in/.test(dimensionMatch[0]) ? "inch" : "cm"}`
    : undefined;
  const size = simpleSize
    ? `${simpleSize[1]} ${/inch|inches|in/.test(simpleSize[2]) ? "inch" : simpleSize[2]}`
    : undefined;

  const packMatch = low.match(/pack\s+of\s+(\d+)|(?:set|pack)\s+of\s+(\d+)|(\d+)\s*[- ]?piece\s+set/i);
  const pack = packMatch ? `Pack/set of ${packMatch[1] ?? packMatch[2] ?? packMatch[3]}` : undefined;

  const material = MATERIALS.find((item) => new RegExp(`\\b${item.replace(/\s+/g, "\\s+")}\\b`, "i").test(low));
  const audience = /\b(men|man|mens|men's)\b/i.test(low)
    ? "men"
    : /\b(women|woman|womens|women's|ladies)\b/i.test(low)
      ? "women"
      : /\b(kids?|children|baby|infant|toddler|boys?|girls?)\b/i.test(low)
        ? "kids"
        : /\bunisex\b/i.test(low) ? "unisex users" : undefined;

  const attributes = unique(
    ATTRIBUTE_PATTERNS.filter(([re]) => re.test(low)).map(([, value]) => value),
  );

  // Extract explicit facts from the title rather than inventing specs.
  const facts: string[] = [];
  if (material) facts.push(`${capitalize(material)} construction`);
  if (attributes.length) facts.push(...attributes);
  if (dimensions) facts.push(`Dimensions: ${dimensions}`);
  else if (size) facts.push(`Size: ${size}`);
  if (pack) facts.push(pack);
  if (audience) facts.push(`For ${audience}`);

  const uses: string[] = [];
  if (hint?.type === "pooja mandir") uses.push("home prayer space", "puja setup", "daily worship");
  else if (hint?.type === "charger") uses.push("daily device charging", "home or office", "travel");
  else if (hint?.type === "audio product") uses.push("music", "calls", "entertainment");
  else if (hint?.type === "wearable") uses.push("daily activity tracking", "notifications", "fitness routines");
  else if (hint?.type === "home furnishing") uses.push("home use", "bedroom or living space", "home refresh");
  else if (category) uses.push(`${category.toLowerCase()} use`);

  const productType = hint?.type ?? inferProductType(t, category);
  const noun = hint?.noun ?? inferNoun(productType);

  return {
    title: t,
    productType,
    noun,
    material,
    size,
    dimensions,
    pack,
    audience,
    attributes,
    uses,
    facts,
  };
}

function inferProductType(title: string, category: string): string {
  // Use the first useful title phrase as the product identity. The category is
  // only a fallback; it must never supply made-up specifications.
  const stripped = title
    .replace(/\([^)]*\)/g, "")
    .split(/[|,:]/)[0]
    .replace(/\b(for|with|from|by)\b.*$/i, "")
    .trim();
  if (stripped.length >= 3) return stripped;
  return category?.trim() || "product";
}

function inferNoun(productType: string): string {
  const words = productType.split(/\s+/).filter(Boolean);
  return words.slice(-3).join(" ") || "product";
}

function capitalize(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function buildContent(facts: ProductFacts, discountPct: number): DealSeoContent {
  const r = rng(hashSeed(`${facts.title}|${facts.productType}`));
  const factText = facts.facts.slice(0, 6);
  const attributes = facts.attributes.slice(0, 5);
  const uses = facts.uses.slice(0, 3);
  const identity = facts.productType;
  const noun = facts.noun;

  const features = unique([
    ...factText,
    ...attributes.map((item) => `${item} design`),
    facts.dimensions ? `Listed dimensions: ${facts.dimensions}` : "",
    facts.size ? `Listed size: ${facts.size}` : "",
    facts.pack ? facts.pack : "",
  ]).slice(0, 7);

  if (!features.length) {
    features.push(`Product type: ${identity}`);
  }

  const benefits: string[] = [];
  if (attributes.includes("LED light")) benefits.push("The built-in LED light can provide illumination for the product's intended setup.");
  if (attributes.includes("drawer")) benefits.push("The drawer provides a dedicated place to keep small items used with the product.");
  if (attributes.includes("shelves")) benefits.push("The shelves provide additional space for organizing items around the product.");
  if (attributes.includes("wall mounted") && attributes.includes("tabletop")) benefits.push("Wall-mounted or tabletop placement gives you flexibility when deciding where to use it.");
  else if (attributes.includes("wall mounted")) benefits.push("The wall-mounted design can help use vertical space where suitable.");
  else if (attributes.includes("tabletop")) benefits.push("The tabletop format is convenient when you want a freestanding setup.");
  if (attributes.includes("foldable")) benefits.push("The foldable design can make storage and carrying easier.");
  if (attributes.includes("portable") || attributes.includes("compact")) benefits.push("The compact or portable design can be useful where space is limited.");
  if (facts.material) benefits.push(`The ${facts.material} construction is explicitly stated in the product title.`);
  if (uses.length) benefits.push(`Its stated use cases include ${joinList(uses)}.`);
  if (!benefits.length) benefits.push(`Its main benefit is the set of features explicitly listed in the product title.`);

  const tips = unique([
    facts.dimensions ? `Measure your available space against the listed ${facts.dimensions} dimensions.` : "Check the listed dimensions or size against your available space before ordering.",
    attributes.includes("wall mounted") ? "If wall mounting is planned, check the mounting method and included hardware in the retailer listing." : "Check the retailer listing for installation or assembly requirements before ordering.",
    attributes.includes("DIY assembly") ? "Review the assembly instructions and confirm what hardware is included." : "Check the package contents and product specifications before ordering.",
    "Read the retailer's return policy so you know what to do if the delivered product is damaged or different from the listing.",
  ]).slice(0, 4);

  const who = facts.audience
    ? `This ${noun} may suit ${facts.audience} looking for a ${identity} with the features listed above.`
    : uses.length
      ? `This ${noun} may suit shoppers looking for a ${identity} for ${joinList(uses)}.`
      : `This ${noun} may suit shoppers whose needs match the features and specifications listed above.`;

  const faqFacts = factText.slice(0, 3);
  const faqs = faqFacts.map((fact) => ({
    q: `What should I know about ${fact.toLowerCase()}?`,
    a: `The product title explicitly lists ${fact.toLowerCase()}. Check the retailer listing for any additional specifications or usage instructions before buying.`,
  }));
  while (faqs.length < 3) {
    const fallbackQuestions = [
      { q: "What are the listed dimensions?", a: facts.dimensions ? `The title lists ${facts.dimensions}. Verify the dimensions on the retailer page before ordering.` : "The dimensions are not available in the product title. Check the retailer listing for the exact measurements." },
      { q: "Does it require assembly?", a: attributes.includes("DIY assembly") ? "The title indicates DIY assembly. Check the listing for the assembly instructions and included hardware." : "Assembly requirements are not stated in the title. Check the retailer listing before ordering." },
      { q: "What is included with the product?", a: "The exact package contents are not fully stated in the title. Check the retailer listing for the complete package details." },
    ];
    const candidate = fallbackQuestions[faqs.length];
    if (candidate) faqs.push(candidate);
    else break;
  }

  const priceSentence = discountPct > 0
    ? `The page currently shows a ${discountPct}% discount; prices and availability can change, so check the latest listing before purchasing.`
    : "Price and availability can change, so check the latest retailer listing before purchasing.";

  const description = [
    `The ${facts.title} is presented as a ${identity}.`,
    factText.length ? `The title specifically mentions ${joinList(factText.slice(0, 5))}.` : "The title provides limited specifications, so the description avoids adding unverified claims.",
    uses.length ? `The stated use cases are ${joinList(uses)}.` : "Its exact use case depends on the buyer's needs.",
    benefits.slice(0, 2).join(" "),
    tips[0],
    priceSentence,
    `Overall, this ${noun} is best evaluated against the exact features, dimensions and setup requirements shown on the retailer listing.`,
  ].join(" ");

  const meta = `${facts.title} — features, specifications, buying tips and FAQs on CheckThePrice.`;
  const metaDescription = clampMeta(meta);

  return {
    metaDescription,
    description,
    features,
    benefits: unique(benefits).slice(0, 5),
    whoShouldBuy: who,
    buyingTips: tips,
    faqs: uniqueFaqs(faqs).slice(0, 3),
  };
}

function uniqueFaqs(values: { q: string; a: string }[]): { q: string; a: string }[] {
  const seen = new Set<string>();
  return values.filter((item) => {
    const key = item.q.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clampMeta(value: string): string {
  if (value.length <= 160) return value;
  return `${value.slice(0, 157).replace(/\s+\S*$/, "")}...`;
}

export function generateSeoContent(
  title: string,
  category: string,
  discountPct: number,
): DealSeoContent {
  const facts = analyzeTitle(title, category);
  return buildContent(facts, discountPct);
}

const memCache = new Map<string, DealSeoContent>();

function cacheKey(title: string, category: string): string {
  return `ctp:seo:v3:${hashSeed(`${title}|${category}`).toString(36)}`;
}

export function getSeoContent(
  title: string,
  category: string,
  discountPct: number,
): DealSeoContent {
  const key = cacheKey(title, category);
  const mem = memCache.get(key);
  if (mem) return mem;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as DealSeoContent;
        memCache.set(key, parsed);
        return parsed;
      }
    } catch {
      // Ignore invalid/stale browser cache and regenerate.
    }
  }
  const content = generateSeoContent(title, category, discountPct);
  memCache.set(key, content);
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(key, JSON.stringify(content)); } catch {}
  }
  return content;
}

export function formatUpdatedAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "Recently updated";
  const diff = Math.max(0, Date.now() - ts);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Updated ${days}d ago`;
  return `Updated ${Math.floor(days / 7)}w ago`;
}
