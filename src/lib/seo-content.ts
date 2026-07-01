// Deterministic per-title SEO content generator.
// Same title => same content forever (no need to regenerate on reload).
// We also memoize per session and persist in localStorage so browsers
// see stable content across visits.

export interface DealSeoContent {
  metaDescription: string; // 150-160 chars
  description: string; // 150-250 words
  features: string[]; // 5-7
  benefits: string[]; // 3-5
  whoShouldBuy: string;
  buyingTips: string[]; // 3-5
  faqs: { q: string; a: string }[]; // 3
}

// -------- Seeded RNG (mulberry32) --------
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
const pick = <T>(r: () => number, arr: T[]) =>
  arr[Math.floor(r() * arr.length)];
function shuffle<T>(r: () => number, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// -------- Category vocabularies --------
type CatKey =
  | "electronics"
  | "wearables"
  | "fashion"
  | "home"
  | "beauty"
  | "kitchen"
  | "sports"
  | "books"
  | "toys"
  | "general";

function detectCategory(title: string, category: string): CatKey {
  const s = `${category} ${title}`.toLowerCase();
  if (/(watch|band|fitness tracker|smartwatch|wearable)/.test(s)) return "wearables";
  if (/(shirt|jean|dress|shoe|sneaker|apparel|fashion|kurta|saree|jacket)/.test(s)) return "fashion";
  if (/(headphone|earbud|speaker|tv|laptop|mobile|phone|charger|electronics|camera|monitor|tablet|router)/.test(s)) return "electronics";
  if (/(cookware|kitchen|mixer|blender|toaster|cooker|pan|bottle)/.test(s)) return "kitchen";
  if (/(cream|serum|lipstick|beauty|shampoo|face|skin|makeup)/.test(s)) return "beauty";
  if (/(sport|yoga|gym|dumbbell|cycle|bike|racket|football|cricket)/.test(s)) return "sports";
  if (/(book|novel|guide|kindle)/.test(s)) return "books";
  if (/(toy|puzzle|lego|game)/.test(s)) return "toys";
  if (/(home|decor|furniture|light|lamp|curtain|bedsheet)/.test(s)) return "home";
  return "general";
}

const VOCAB: Record<CatKey, {
  adjectives: string[];
  useCases: string[];
  audiences: string[];
  featurePool: string[];
  benefitPool: string[];
  tipPool: string[];
  faqPool: { q: string; a: string }[];
}> = {
  electronics: {
    adjectives: ["reliable", "feature-packed", "well-built", "smartly designed", "everyday-ready"],
    useCases: ["daily use at home", "office productivity", "travel and commutes", "entertainment sessions", "long study hours"],
    audiences: ["students", "working professionals", "gadget enthusiasts", "families upgrading their setup", "gift shoppers"],
    featurePool: [
      "Modern build quality with tested components",
      "Simple plug-and-play setup — no complex configuration",
      "Energy-efficient performance for extended sessions",
      "Compatible with common accessories and standards",
      "Compact form factor that fits most desks and bags",
      "Clear indicators and intuitive controls",
      "Warranty and after-sales support from the seller",
    ],
    benefitPool: [
      "Saves time with quick setup and dependable performance",
      "Reduces clutter thanks to a thoughtful, compact design",
      "Delivers consistent results even during heavy use",
      "Offers real value at this discounted price point",
    ],
    tipPool: [
      "Check the seller rating and return window before ordering.",
      "Confirm the warranty terms and register the product after delivery.",
      "Compare current price with the last-30-days trend to spot a real drop.",
      "Read a few recent verified reviews to catch any batch-specific issues.",
    ],
    faqPool: [
      { q: "Is this product covered under warranty?", a: "Warranty terms are set by the seller. Verify the exact warranty duration on the product page before purchasing." },
      { q: "Will it work with my existing accessories?", a: "In most cases yes — it uses common standards. Cross-check the specs listed on the retailer page against your existing gear." },
      { q: "How fast is delivery?", a: "Delivery timing depends on your pin code and the seller. Enter your address on the retailer page for an accurate ETA." },
    ],
  },
  wearables: {
    adjectives: ["comfortable", "lightweight", "everyday-friendly", "stylish", "activity-ready"],
    useCases: ["daily fitness tracking", "workday notifications", "sleep monitoring", "outdoor workouts", "casual wear"],
    audiences: ["fitness beginners", "regular gym-goers", "busy professionals", "students", "anyone building healthier habits"],
    featurePool: [
      "Comfortable strap suited for all-day wear",
      "Clear display that stays readable outdoors",
      "Battery life designed to last multiple days on a charge",
      "Tracks core health and activity metrics",
      "Companion app support for progress history",
      "Water/splash resistance for real-world use",
      "Lightweight build so you barely notice it",
    ],
    benefitPool: [
      "Keeps daily activity and sleep visible at a glance",
      "Encourages consistent movement with gentle nudges",
      "Reduces the need to pull out your phone constantly",
      "Makes tracking progress toward fitness goals easier",
    ],
    tipPool: [
      "Pick the right strap size — sizing charts vary by brand.",
      "Charge fully before first use and update firmware early.",
      "Enable only the notifications you actually need to save battery.",
      "Wipe the sensor area regularly for accurate readings.",
    ],
    faqPool: [
      { q: "Does it work with both Android and iPhone?", a: "Most modern wearables support both. Confirm the required companion app and OS version on the product page before buying." },
      { q: "Is it safe to wear while showering or swimming?", a: "It depends on the water resistance rating. Check the exact IP rating on the retailer page before exposing it to water." },
      { q: "How accurate are the health readings?", a: "Consumer wearables are best used for trends rather than medical-grade data. Look at week-over-week patterns instead of single-second values." },
    ],
  },
  fashion: {
    adjectives: ["versatile", "well-fitting", "everyday", "stylish", "easy-care"],
    useCases: ["daily wear", "college and office", "weekend outings", "casual gifting", "layering with existing wardrobe"],
    audiences: ["value-conscious shoppers", "students", "young professionals", "gift buyers", "anyone refreshing their wardrobe"],
    featurePool: [
      "Breathable fabric that feels comfortable through the day",
      "Fit designed to flatter a range of body types",
      "Reinforced stitching for longer wear",
      "Colour options that pair well with existing outfits",
      "Easy machine-wash care for busy schedules",
      "Neutral styling that works across occasions",
      "True-to-size sizing based on standard charts",
    ],
    benefitPool: [
      "Adds an easy, wearable option to your everyday rotation",
      "Holds shape and colour better than typical fast-fashion pieces",
      "Delivers a polished look without dry-clean-only care",
      "Great value at this discounted price",
    ],
    tipPool: [
      "Cross-check the size chart — brand sizing can vary a lot.",
      "Read a few reviews with photos to judge real fit and colour.",
      "Confirm the return/exchange policy before ordering multiple sizes.",
      "Wash inside-out on a gentle cycle for the first few washes.",
    ],
    faqPool: [
      { q: "How do I choose the right size?", a: "Measure yourself and match against the size chart on the product page — don't rely on your usual size from other brands." },
      { q: "Is the colour on my screen accurate?", a: "Colours may shift slightly depending on your display. Buyer photos in reviews are usually the best reference." },
      { q: "Can I exchange it if the fit isn't right?", a: "Fashion items are usually eligible for exchange within the retailer's return window. Verify the specific policy before ordering." },
    ],
  },
  kitchen: {
    adjectives: ["practical", "durable", "kitchen-friendly", "easy-to-clean", "everyday"],
    useCases: ["daily cooking", "family meals", "quick weekday prep", "weekend baking", "small kitchens"],
    audiences: ["home cooks", "new households", "students living solo", "gift shoppers", "anyone upgrading old kitchenware"],
    featurePool: [
      "Food-safe materials suited for regular cooking",
      "Ergonomic handles for a secure grip",
      "Easy to clean — most parts rinse quickly",
      "Compact storage-friendly design",
      "Even heat distribution where relevant",
      "Sturdy build that stands up to daily use",
      "Neutral finish that suits most kitchens",
    ],
    benefitPool: [
      "Cuts down cooking and cleanup time",
      "Replaces multiple older items with one dependable pick",
      "Handles daily use without wearing out quickly",
      "Good value at this deal price",
    ],
    tipPool: [
      "Wash before first use as per the seller's instructions.",
      "Avoid harsh scrubbers to protect any coatings.",
      "Check compatibility with your stove type (gas / induction).",
      "Store dry to prevent stains and odours over time.",
    ],
    faqPool: [
      { q: "Is it induction compatible?", a: "Not every kitchen item is induction-ready. Check the product specs before buying if you cook on induction." },
      { q: "Is it dishwasher safe?", a: "Dishwasher safety depends on the exact material and coating. Verify on the product page and follow the seller's care instructions." },
      { q: "How long does it typically last?", a: "With regular gentle care — mild detergent, soft sponge, dry storage — it should last for years of everyday use." },
    ],
  },
  beauty: {
    adjectives: ["gentle", "everyday", "skin-friendly", "easy-to-use", "well-formulated"],
    useCases: ["daily skincare routine", "on-the-go touch-ups", "travel", "gifting", "gradual results over weeks"],
    audiences: ["beauty beginners", "routine-focused users", "gift shoppers", "value-conscious buyers", "anyone rebuilding their kit"],
    featurePool: [
      "Formulation designed for regular use",
      "Lightweight feel that layers well with other products",
      "Travel-friendly packaging",
      "Ingredients suited to a wide range of skin types",
      "Fragrance kept subtle for daily wear",
      "Simple application — no special tools required",
      "Clear usage guidance on the label",
    ],
    benefitPool: [
      "Slots easily into an existing routine",
      "Delivers consistent results with regular use",
      "Offers salon-adjacent care at home for less",
      "Great value in this discounted pack",
    ],
    tipPool: [
      "Patch-test on a small area before regular use if you have sensitive skin.",
      "Check the manufacturing/expiry date on delivery.",
      "Store in a cool, dry place to preserve the formula.",
      "Read the ingredient list if you have known allergies.",
    ],
    faqPool: [
      { q: "Is it safe for sensitive skin?", a: "Most everyday formulations are gentle, but sensitive-skin buyers should always patch-test and check the ingredient list first." },
      { q: "How long will one pack last?", a: "Duration depends on how often you use it. For daily users, a standard pack typically lasts several weeks." },
      { q: "How do I check authenticity?", a: "Buy from the official brand store or a trusted seller on the retailer, and check the batch/manufacturing details on the packaging." },
    ],
  },
  home: {
    adjectives: ["thoughtful", "practical", "space-friendly", "everyday", "well-made"],
    useCases: ["living room refresh", "bedroom setup", "small apartments", "gifting for housewarmings", "rental-friendly upgrades"],
    audiences: ["new households", "students in shared flats", "anyone redecorating", "gift shoppers", "budget-conscious buyers"],
    featurePool: [
      "Design that fits typical Indian home layouts",
      "Durable materials for regular use",
      "Easy to clean and maintain",
      "Neutral styling that blends with most decor",
      "Sensible weight for easy handling",
      "Space-conscious footprint",
      "Ships with clear setup instructions",
    ],
    benefitPool: [
      "Refreshes a room without a full makeover",
      "Combines looks with day-to-day usefulness",
      "Easy to relocate as your space changes",
      "Solid value at this deal price",
    ],
    tipPool: [
      "Measure the intended spot before ordering.",
      "Inspect the package on delivery and report damage quickly.",
      "Follow the seller's care instructions to keep the finish intact.",
      "Keep the packaging until you're sure you're keeping it.",
    ],
    faqPool: [
      { q: "Does it require assembly?", a: "Some home items ship assembled while others need light setup. Check the product page for assembly details before ordering." },
      { q: "Is installation included?", a: "Installation is not always included by default. Confirm with the seller if installation is offered in your area." },
      { q: "How is it packed for shipping?", a: "Reputable sellers protective-pack fragile items. If it arrives damaged, raise a return request within the retailer's policy window." },
    ],
  },
  sports: {
    adjectives: ["training-ready", "durable", "grip-friendly", "beginner-friendly", "everyday-workout"],
    useCases: ["home workouts", "gym sessions", "outdoor training", "beginner routines", "recovery days"],
    audiences: ["fitness beginners", "gym regulars", "students building a home setup", "anyone returning to training", "gift shoppers"],
    featurePool: [
      "Built for regular training use",
      "Grip-friendly finish for safer handling",
      "Sensible weight distribution",
      "Compact enough for home storage",
      "Neutral design that suits any setup",
      "Materials chosen to handle sweat and repeated use",
      "Clear sizing/spec labelling",
    ],
    benefitPool: [
      "Makes it easier to stay consistent with training",
      "Cuts gym trips by enabling more at-home sessions",
      "Delivers dependable performance workout after workout",
      "Great value at this discounted price",
    ],
    tipPool: [
      "Match the size/weight to your current level, not your goal.",
      "Warm up before using any weighted or resistance product.",
      "Wipe down after every workout to extend its life.",
      "Store away from moisture to prevent rust or wear.",
    ],
    faqPool: [
      { q: "Is this suitable for beginners?", a: "Yes — start with lighter loads or easier settings and progress gradually as your form improves." },
      { q: "Do I need any extra accessories?", a: "For most home-training gear, no. Any recommended add-ons are usually called out on the product page." },
      { q: "How do I clean it?", a: "A quick wipe with a slightly damp cloth after each use is usually enough. Avoid harsh chemicals." },
    ],
  },
  books: {
    adjectives: ["engaging", "well-written", "easy-to-follow", "insightful", "worth-reading"],
    useCases: ["daily reading habit", "travel reads", "study support", "gifting", "book-club picks"],
    audiences: ["students", "casual readers", "professionals looking to learn", "gift shoppers", "avid readers"],
    featurePool: [
      "Clear structure that's easy to follow",
      "Content depth suitable for the target reader",
      "Print quality that's comfortable for long reads",
      "Portable format for daily commutes",
      "Well-organised chapters and index",
      "Practical takeaways in each section",
      "Sensible pricing for the value delivered",
    ],
    benefitPool: [
      "Deepens understanding of the subject",
      "Great value compared to online courses on similar topics",
      "Makes a thoughtful, long-lasting gift",
      "Perfect for building a regular reading habit",
    ],
    tipPool: [
      "Confirm the edition and language before ordering.",
      "Check whether it's paperback or hardcover.",
      "Read the preview or sample pages if available.",
      "Buy from trusted sellers to avoid pirated prints.",
    ],
    faqPool: [
      { q: "Is this the latest edition?", a: "Editions vary by listing. Check the edition and publication year on the product page before purchasing." },
      { q: "Which language is it in?", a: "Language is listed on the product page. Confirm before ordering — some titles are available in multiple languages." },
      { q: "Is it paperback or hardcover?", a: "Both formats are often available. Check the format selection on the retailer page to pick the version you want." },
    ],
  },
  toys: {
    adjectives: ["fun", "engaging", "safe-to-play", "age-appropriate", "well-made"],
    useCases: ["indoor playtime", "birthday gifts", "screen-free entertainment", "creative play", "learning through play"],
    audiences: ["parents", "gift shoppers", "grandparents", "teachers", "anyone shopping for kids"],
    featurePool: [
      "Child-friendly materials",
      "Sturdy build for repeated play",
      "Age-appropriate design",
      "Encourages creativity and focus",
      "Simple to set up and start playing",
      "Compact enough to store easily",
      "Colours designed to appeal to kids",
    ],
    benefitPool: [
      "Encourages screen-free playtime",
      "Supports skill-building through fun activities",
      "Reliable go-to gift for kids' birthdays",
      "Great value in this discounted pack",
    ],
    tipPool: [
      "Check the recommended age range on the packaging.",
      "Supervise young children during first use.",
      "Keep small parts away from toddlers.",
      "Store neatly to keep pieces from getting lost.",
    ],
    faqPool: [
      { q: "What age range is this suitable for?", a: "Age suitability is listed on the product page — always follow the manufacturer's guidance." },
      { q: "Is it safe for young children?", a: "Choose age-appropriate toys and always supervise young children, especially with small parts." },
      { q: "Are batteries included?", a: "If the toy needs batteries, check the product page to see whether they're included in the box." },
    ],
  },
  general: {
    adjectives: ["useful", "well-thought-out", "everyday", "practical", "value-packed"],
    useCases: ["daily use", "gifting", "everyday needs", "home or office", "casual buyers"],
    audiences: ["value-conscious shoppers", "students", "working professionals", "gift buyers", "first-time buyers"],
    featurePool: [
      "Sensible everyday design",
      "Materials chosen for daily use",
      "Easy to use without a learning curve",
      "Compact and easy to store",
      "Backed by seller support",
      "Neutral styling that fits most preferences",
      "Solid value for the price",
    ],
    benefitPool: [
      "Solves a real everyday need",
      "Saves money compared to the usual MRP",
      "Simple to gift — safe universal pick",
      "Delivers dependable performance day after day",
    ],
    tipPool: [
      "Read the latest reviews before ordering.",
      "Confirm the return window with the seller.",
      "Compare with 1–2 similar listings to be sure.",
      "Check delivery timelines for your pin code.",
    ],
    faqPool: [
      { q: "Is this a genuine product?", a: "Buy from the brand's official store or a top-rated seller to make sure you're getting a genuine product." },
      { q: "What is the return policy?", a: "Return terms are set by the retailer and seller. Check the exact return window on the product page before ordering." },
      { q: "How long does delivery take?", a: "Delivery time depends on your pin code and the seller. Enter your address on the retailer page for a precise ETA." },
    ],
  },
};

function toTitleWords(title: string): string {
  return title.replace(/\s+/g, " ").trim();
}

export function generateSeoContent(
  title: string,
  category: string,
  discountPct: number,
): DealSeoContent {
  const cat = detectCategory(title, category);
  const v = VOCAB[cat];
  const seed = hashSeed(`${title}|${category}`);
  const r = rng(seed);
  const t = toTitleWords(title);

  const adj = pick(r, v.adjectives);
  const useCase = pick(r, v.useCases);
  const audience = pick(r, v.audiences);
  const audience2 = pick(r, v.audiences);

  const features = shuffle(r, v.featurePool).slice(0, 5 + Math.floor(r() * 3));
  const benefits = shuffle(r, v.benefitPool).slice(0, 3 + Math.floor(r() * 2));
  const tips = shuffle(r, v.tipPool).slice(0, 3 + Math.floor(r() * 2));
  const faqs = shuffle(r, v.faqPool).slice(0, 3);

  // Build a 150-250 word description using multiple mixed sentence templates.
  const openers = [
    `The ${t} is a ${adj} pick for shoppers who want a dependable option without overspending.`,
    `Looking for a ${adj} ${category.toLowerCase()} option? The ${t} is worth a serious look right now.`,
    `If you've been hunting for a ${adj} upgrade, the ${t} lines up neatly with what most buyers actually need.`,
    `The ${t} focuses on the essentials — ${adj} build, sensible design, and a price that finally makes it easy to say yes.`,
  ];
  const middles = [
    `It's built with ${useCase} in mind, so it feels at home in real routines instead of only looking good in photos.`,
    `Whether you're using it for ${useCase} or occasional needs, it holds up without demanding a lot of attention.`,
    `Designed around ${useCase}, it keeps the experience simple — set it up, use it, forget about it.`,
  ];
  const priceLine =
    discountPct >= 65
      ? `At the current discount of around ${discountPct}%, this is one of the sharper price drops we've seen for this kind of product.`
      : discountPct >= 40
        ? `With about ${discountPct}% off right now, the pricing lands in a genuinely attractive zone versus the usual MRP.`
        : `Even at a modest discount, the current price is worth checking against your usual online source before you decide.`;
  const closers = [
    `Overall, the ${t} is a sensible pick for ${audience} and ${audience2} who want to buy once and move on.`,
    `In short, it's a straightforward recommendation for ${audience} — and a safe gift idea for ${audience2}.`,
    `Bottom line: if you're a fit for the description above, the ${t} deserves a spot on your shortlist.`,
  ];

  const description = [
    pick(r, openers),
    pick(r, middles),
    priceLine,
    `On the practical side, expect ${features[0].toLowerCase()} and ${features[1].toLowerCase()} — the kind of details that quietly matter every day.`,
    `It also earns points for ${benefits[0].toLowerCase()}, which is exactly why buyers keep coming back to picks like this one.`,
    pick(r, closers),
  ].join(" ");

  const whoShouldBuy = `The ${t} is a strong fit for ${audience} looking for a ${adj} option, and equally suited to ${audience2} who prefer buys that quietly work day after day. It's especially worth a look if ${useCase} is a regular part of your routine.`;

  // Meta description: 150-160 chars, unique per title
  const metaBase = `Grab the ${t} at ${discountPct}% off on CheckThePrice — features, buying tips, FAQs and price-drop alerts for ${audience.toLowerCase()}.`;
  const metaDescription = clampMeta(metaBase, t, discountPct, audience);

  return {
    metaDescription,
    description,
    features,
    benefits,
    whoShouldBuy,
    buyingTips: tips,
    faqs,
  };
}

function clampMeta(s: string, t: string, d: number, audience: string): string {
  let out = s;
  if (out.length >= 150 && out.length <= 160) return out;
  if (out.length > 160) {
    out = out.slice(0, 157).replace(/\s+\S*$/, "") + "...";
    return out.length >= 150 ? out : (out + " Save more today.").slice(0, 160);
  }
  // pad
  const pad = ` Check verified deal details, savings and alerts — pick smart today.`;
  out = (s + pad).slice(0, 160);
  if (out.length < 150) {
    out = (out + " Shop smart.").slice(0, 160);
  }
  return out;
}

// -------- Session + localStorage cache --------
const memCache = new Map<string, DealSeoContent>();

function cacheKey(title: string, category: string): string {
  return `ctp:seo:${hashSeed(`${title}|${category}`).toString(36)}`;
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
    } catch {}
  }
  const generated = generateSeoContent(title, category, discountPct);
  memCache.set(key, generated);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(key, JSON.stringify(generated));
    } catch {}
  }
  return generated;
}

export function formatUpdatedAgo(ts: number | undefined): string {
  if (!ts) return "Recently updated";
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Updated ${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `Updated ${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `Updated ${months} month${months === 1 ? "" : "s"} ago`;
}