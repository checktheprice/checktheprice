/**
 * Centralized category normalization.
 *
 * Firecrawl extracts category text that differs wildly between merchants
 * ("Mobile Phones", "Smartphones", "Cell Phones", ...). Every write path must
 * funnel scraped category text through `normalizeCategory` so the site never
 * grows new ad-hoc categories. Add new aliases here — nowhere else.
 */

export const CANONICAL_CATEGORIES = [
  "Mobiles",
  "Audio",
  "Wearables",
  "Laptops",
  "Computer Accessories",
  "Electronics",
  "Home Appliances",
  "Kitchen",
  "Fashion",
  "Beauty",
  "Home & Furniture",
  "Grocery",
  "Toys & Baby",
  "Sports & Fitness",
  "Books",
  "Other",
] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

export const FALLBACK_CATEGORY: CanonicalCategory = "Other";

/** Most important categories first, for compact homepage chips. */
export const CATEGORY_DISPLAY_ORDER: readonly CanonicalCategory[] = [
  "Mobiles",
  "Audio",
  "Wearables",
  "Laptops",
  "Computer Accessories",
  "Electronics",
  "Home Appliances",
  "Kitchen",
  "Fashion",
  "Beauty",
  "Home & Furniture",
  "Grocery",
  "Toys & Baby",
  "Sports & Fitness",
  "Books",
  "Other",
];

/** alias (lowercased, normalized whitespace) -> canonical category */
export const CATEGORY_ALIASES: Record<string, CanonicalCategory> = {
  // Mobiles
  mobile: "Mobiles",
  mobiles: "Mobiles",
  "mobile phone": "Mobiles",
  "mobile phones": "Mobiles",
  smartphone: "Mobiles",
  smartphones: "Mobiles",
  "cell phone": "Mobiles",
  "cell phones": "Mobiles",
  "cellular phone": "Mobiles",
  phone: "Mobiles",
  phones: "Mobiles",
  "mobiles & accessories": "Mobiles",
  tablet: "Mobiles",
  tablets: "Mobiles",

  // Audio
  audio: "Audio",
  earbuds: "Audio",
  "bluetooth earbuds": "Audio",
  "wireless earbuds": "Audio",
  tws: "Audio",
  "true wireless": "Audio",
  earphone: "Audio",
  earphones: "Audio",
  headphone: "Audio",
  headphones: "Audio",
  headset: "Audio",
  neckband: "Audio",
  speaker: "Audio",
  speakers: "Audio",
  "bluetooth speaker": "Audio",
  soundbar: "Audio",
  "home audio": "Audio",
  "headphones & earphones": "Audio",

  // Wearables
  wearable: "Wearables",
  wearables: "Wearables",
  smartwatch: "Wearables",
  smartwatches: "Wearables",
  "smart watch": "Wearables",
  "smart watches": "Wearables",
  watch: "Wearables",
  watches: "Wearables",
  "fitness band": "Wearables",
  "fitness bands": "Wearables",
  "fitness tracker": "Wearables",
  "activity tracker": "Wearables",

  // Laptops
  laptop: "Laptops",
  laptops: "Laptops",
  notebook: "Laptops",
  notebooks: "Laptops",
  "notebook pc": "Laptops",
  "notebook pcs": "Laptops",
  ultrabook: "Laptops",
  chromebook: "Laptops",
  macbook: "Laptops",
  "gaming laptop": "Laptops",

  // Computer Accessories
  keyboard: "Computer Accessories",
  keyboards: "Computer Accessories",
  mouse: "Computer Accessories",
  mice: "Computer Accessories",
  "computer accessory": "Computer Accessories",
  "computer accessories": "Computer Accessories",
  "laptop accessories": "Computer Accessories",
  monitor: "Computer Accessories",
  monitors: "Computer Accessories",
  printer: "Computer Accessories",
  printers: "Computer Accessories",
  webcam: "Computer Accessories",
  "pen drive": "Computer Accessories",
  "hard disk": "Computer Accessories",
  ssd: "Computer Accessories",
  "external hard drive": "Computer Accessories",
  router: "Computer Accessories",

  // Electronics (generic bucket that already exists on the site)
  electronic: "Electronics",
  electronics: "Electronics",
  gadget: "Electronics",
  gadgets: "Electronics",
  television: "Electronics",
  televisions: "Electronics",
  tv: "Electronics",
  tvs: "Electronics",
  "smart tv": "Electronics",
  "led tv": "Electronics",
  camera: "Electronics",
  cameras: "Electronics",
  "power bank": "Electronics",
  charger: "Electronics",
  chargers: "Electronics",
  "mobile accessories": "Electronics",
  "gaming console": "Electronics",
  "video games": "Electronics",

  // Home Appliances
  appliance: "Home Appliances",
  appliances: "Home Appliances",
  "home appliance": "Home Appliances",
  "home appliances": "Home Appliances",
  "large appliances": "Home Appliances",
  refrigerator: "Home Appliances",
  refrigerators: "Home Appliances",
  fridge: "Home Appliances",
  "washing machine": "Home Appliances",
  "washing machines": "Home Appliances",
  "air conditioner": "Home Appliances",
  "air conditioners": "Home Appliances",
  ac: "Home Appliances",
  "air cooler": "Home Appliances",
  "air purifier": "Home Appliances",
  "water purifier": "Home Appliances",
  "vacuum cleaner": "Home Appliances",
  "geyser": "Home Appliances",
  "water heater": "Home Appliances",
  fan: "Home Appliances",
  fans: "Home Appliances",

  // Kitchen
  kitchen: "Kitchen",
  "kitchen appliance": "Kitchen",
  "kitchen appliances": "Kitchen",
  "kitchen tool": "Kitchen",
  "kitchen tools": "Kitchen",
  "kitchen accessory": "Kitchen",
  "kitchen accessories": "Kitchen",
  cookware: "Kitchen",
  cookwares: "Kitchen",
  mixer: "Kitchen",
  "mixer grinder": "Kitchen",
  microwave: "Kitchen",
  "microwave oven": "Kitchen",
  "induction cooktop": "Kitchen",
  "pressure cooker": "Kitchen",
  "air fryer": "Kitchen",
  "electric kettle": "Kitchen",
  dinnerware: "Kitchen",

  // Fashion
  fashion: "Fashion",
  clothing: "Fashion",
  clothes: "Fashion",
  apparel: "Fashion",
  apparels: "Fashion",
  "men's fashion": "Fashion",
  "mens fashion": "Fashion",
  "men fashion": "Fashion",
  "women's fashion": "Fashion",
  "womens fashion": "Fashion",
  "women fashion": "Fashion",
  "kids fashion": "Fashion",
  footwear: "Fashion",
  shoe: "Fashion",
  shoes: "Fashion",
  sneakers: "Fashion",
  sandals: "Fashion",
  "t-shirt": "Fashion",
  "t-shirts": "Fashion",
  tshirt: "Fashion",
  shirt: "Fashion",
  shirts: "Fashion",
  jeans: "Fashion",
  ethnic: "Fashion",
  "ethnic wear": "Fashion",
  bag: "Fashion",
  bags: "Fashion",
  backpack: "Fashion",
  luggage: "Fashion",
  sunglasses: "Fashion",
  jewellery: "Fashion",
  jewelry: "Fashion",
  "accessories": "Fashion",

  // Beauty
  beauty: "Beauty",
  "beauty & personal care": "Beauty",
  "personal care": "Beauty",
  cosmetic: "Beauty",
  cosmetics: "Beauty",
  makeup: "Beauty",
  skincare: "Beauty",
  "skin care": "Beauty",
  haircare: "Beauty",
  "hair care": "Beauty",
  fragrance: "Beauty",
  perfume: "Beauty",
  perfumes: "Beauty",
  grooming: "Beauty",
  trimmer: "Beauty",
  "hair dryer": "Beauty",
  "hair straightener": "Beauty",

  // Home & Furniture
  home: "Home & Furniture",
  "home & kitchen": "Home & Furniture",
  "home decor": "Home & Furniture",
  "home improvement": "Home & Furniture",
  "home furnishing": "Home & Furniture",
  furniture: "Home & Furniture",
  furnishing: "Home & Furniture",
  mattress: "Home & Furniture",
  bedsheet: "Home & Furniture",
  bedsheets: "Home & Furniture",
  curtain: "Home & Furniture",
  curtains: "Home & Furniture",
  lighting: "Home & Furniture",
  "tools & hardware": "Home & Furniture",

  // Grocery
  grocery: "Grocery",
  groceries: "Grocery",
  "grocery & gourmet": "Grocery",
  food: "Grocery",
  beverage: "Grocery",
  beverages: "Grocery",
  snacks: "Grocery",
  "health & household": "Grocery",
  supplement: "Grocery",
  supplements: "Grocery",

  // Toys & Baby
  toy: "Toys & Baby",
  toys: "Toys & Baby",
  "toys & games": "Toys & Baby",
  baby: "Toys & Baby",
  "baby products": "Toys & Baby",
  "baby care": "Toys & Baby",
  diaper: "Toys & Baby",
  diapers: "Toys & Baby",
  stationery: "Toys & Baby",

  // Sports & Fitness
  sport: "Sports & Fitness",
  sports: "Sports & Fitness",
  "sports & fitness": "Sports & Fitness",
  fitness: "Sports & Fitness",
  "gym equipment": "Sports & Fitness",
  "exercise equipment": "Sports & Fitness",
  cycle: "Sports & Fitness",
  bicycle: "Sports & Fitness",
  outdoor: "Sports & Fitness",

  // Books
  book: "Books",
  books: "Books",
  ebook: "Books",
  ebooks: "Books",
  kindle: "Books",

  // Explicit fallback synonyms
  other: "Other",
  others: "Other",
  general: "Other",
  misc: "Other",
  miscellaneous: "Other",
  uncategorized: "Other",
};

function clean(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[_/|>,]+/g, " ")
    .replace(/[^a-z0-9&'\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CANONICAL_LOOKUP = new Map<string, CanonicalCategory>(
  CANONICAL_CATEGORIES.map((c) => [clean(c), c]),
);

// Longest aliases first so "kitchen appliances" wins over "kitchen".
const ALIAS_ENTRIES: [string, CanonicalCategory][] = Object.entries(
  CATEGORY_ALIASES,
).sort((a, b) => b[0].length - a[0].length) as [string, CanonicalCategory][];

/**
 * Map arbitrary scraped category text to one of CANONICAL_CATEGORIES.
 * Never invents a category: unknown input becomes "Other".
 */
export function normalizeCategory(
  raw: string | null | undefined,
): CanonicalCategory {
  if (!raw) return FALLBACK_CATEGORY;
  const text = clean(raw);
  if (!text) return FALLBACK_CATEGORY;

  const exactCanonical = CANONICAL_LOOKUP.get(text);
  if (exactCanonical) return exactCanonical;

  const exactAlias = CATEGORY_ALIASES[text];
  if (exactAlias) return exactAlias;

  // Merchant breadcrumbs like "Electronics > Mobiles & Accessories >
  // Smartphones" collapse to a single string; match the longest alias present.
  for (const [alias, canonical] of ALIAS_ENTRIES) {
    const pattern = new RegExp(
      `(^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`,
    );
    if (pattern.test(text)) return canonical;
  }

  return FALLBACK_CATEGORY;
}

/** True when the value is already one of the canonical categories. */
export function isCanonicalCategory(
  value: string | null | undefined,
): value is CanonicalCategory {
  return (
    !!value && (CANONICAL_CATEGORIES as readonly string[]).includes(value)
  );
}

/**
 * Sort a list of category names for display: canonical order first (most
 * important categories leading), unknown legacy values alphabetically after,
 * and "Other" last.
 */
export function sortCategoriesForDisplay(categories: string[]): string[] {
  const rank = (c: string) => {
    if (c === "Other") return 10_000;
    const i = CATEGORY_DISPLAY_ORDER.indexOf(c as CanonicalCategory);
    return i === -1 ? 5_000 : i;
  };
  return [...categories].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}
