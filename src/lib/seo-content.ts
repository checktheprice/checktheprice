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

// ================= Title analyzer =================
// Extracts product-specific attributes from the full product title so the
// generated content actually reflects what's being sold — not just the
// category. This is what makes descriptions unique per product.

interface TitleFacts {
  cleanTitle: string;
  productType: string; // e.g. "insulated lunch bag", "wireless earbuds"
  productNoun: string; // shorter head-noun for reuse, e.g. "lunch bag"
  capacity?: string; // "5 L", "500 ml", "128 GB", "10000 mAh"
  size?: string; // "15.6 inch", "42 mm"
  pack?: string; // "Pack of 3"
  color?: string;
  material?: string;
  audience?: string; // "men and women", "kids", "unisex"
  attributes: string[]; // extra descriptive words found (insulated, waterproof, wireless...)
  useCases: string[]; // derived from title keywords
}

const COLORS = [
  "black","white","blue","navy","red","green","olive","grey","gray","silver",
  "gold","rose gold","pink","purple","yellow","orange","brown","beige","maroon",
  "teal","cyan","turquoise","ivory",
];
const MATERIALS = [
  "stainless steel","cotton","polyester","nylon","leather","pu leather","canvas",
  "silicone","aluminium","aluminum","plastic","glass","ceramic","wood","bamboo",
  "cast iron","copper","denim","linen","rayon","microfiber","neoprene","rubber",
];
const ATTRIBUTE_KEYWORDS = [
  "insulated","thermal","waterproof","water-resistant","water resistant","leak-proof","leak proof","leakproof",
  "wireless","bluetooth","noise-cancelling","noise cancelling","noise-canceling","noise canceling",
  "rechargeable","foldable","portable","lightweight","heavy-duty","heavy duty",
  "non-stick","non stick","nonstick","stainless","reusable","eco-friendly","eco friendly",
  "smart","automatic","manual","adjustable","ergonomic","breathable","quick-dry","quick dry",
  "unbreakable","shockproof","dustproof","fast charging","fast-charging","wide mouth",
  "double wall","double-wall","vacuum","hot and cold","hot & cold","printed","embroidered",
  "slim","compact","professional","premium","organic",
];

// Product-type dictionary. Order matters — longer/more specific phrases first.
const PRODUCT_TYPES: Array<{ match: RegExp; type: string; noun: string; useCases: string[] }> = [
  { match: /insulated\s+lunch\s+bag|lunch\s+bag/i, type: "insulated lunch bag", noun: "lunch bag", useCases: ["carrying lunch to office","school lunches","short trips and picnics","keeping food warm or cool during commutes"] },
  { match: /tiffin\s+box|lunch\s+box/i, type: "lunch box", noun: "lunch box", useCases: ["office lunches","school tiffin","meal-prep at home","travel meals"] },
  { match: /water\s+bottle|sipper|thermos|flask/i, type: "water bottle", noun: "bottle", useCases: ["daily hydration at work","gym and workouts","school and college","travel and long drives"] },
  { match: /backpack|rucksack|laptop\s+bag/i, type: "backpack", noun: "backpack", useCases: ["daily commutes","college and school","short travel","carrying a laptop safely"] },
  { match: /handbag|sling\s+bag|tote|shoulder\s+bag/i, type: "handbag", noun: "bag", useCases: ["daily use","office","casual outings","gifting"] },
  { match: /trolley|suitcase|luggage|travel\s+bag|duffle|duffel/i, type: "travel bag", noun: "travel bag", useCases: ["weekend trips","long travel","business travel","family vacations"] },
  { match: /earbud|airpod|tws/i, type: "wireless earbuds", noun: "earbuds", useCases: ["music on the go","calls and meetings","workouts","daily commutes"] },
  { match: /headphone|headset/i, type: "headphones", noun: "headphones", useCases: ["long listening sessions","work-from-home calls","gaming","travel"] },
  { match: /speaker/i, type: "portable speaker", noun: "speaker", useCases: ["home listening","small gatherings","outdoor use","travel"] },
  { match: /smartwatch|smart\s+watch|fitness\s+band|fitness\s+tracker/i, type: "smartwatch", noun: "watch", useCases: ["daily fitness tracking","notifications on the wrist","sleep monitoring","workouts"] },
  { match: /power\s?bank/i, type: "power bank", noun: "power bank", useCases: ["backup charging on the go","travel","long workdays","emergencies"] },
  { match: /charger|adapter/i, type: "charger", noun: "charger", useCases: ["daily charging at home","office","travel","backup for the family"] },
  { match: /cable|usb\s?-?c|lightning\s+cable/i, type: "charging cable", noun: "cable", useCases: ["daily device charging","desk setup","travel kit","spare for family"] },
  { match: /laptop|notebook\b/i, type: "laptop", noun: "laptop", useCases: ["work-from-home","college assignments","content consumption","light creative work"] },
  { match: /tablet|ipad/i, type: "tablet", noun: "tablet", useCases: ["reading and study","entertainment","light productivity","kids' learning"] },
  { match: /mobile|smartphone|\bphone\b/i, type: "smartphone", noun: "phone", useCases: ["daily communication","photos and videos","apps and productivity","entertainment"] },
  { match: /television|smart\s+tv|\btv\b/i, type: "smart TV", noun: "TV", useCases: ["home entertainment","streaming","family movie nights","gaming"] },
  { match: /monitor\b/i, type: "monitor", noun: "monitor", useCases: ["work-from-home setups","study","light gaming","dual-screen productivity"] },
  { match: /keyboard/i, type: "keyboard", noun: "keyboard", useCases: ["daily typing","office work","light gaming","student use"] },
  { match: /mouse\b|trackpad/i, type: "computer mouse", noun: "mouse", useCases: ["daily desk use","office","study","travel with a laptop"] },
  { match: /mixer\s+grinder|mixie/i, type: "mixer grinder", noun: "mixer grinder", useCases: ["daily Indian cooking","chutneys and masalas","smoothies","meal prep"] },
  { match: /kettle/i, type: "electric kettle", noun: "kettle", useCases: ["quick tea and coffee","instant noodles","hostel and PG rooms","office pantries"] },
  { match: /induction\s+cooktop|induction/i, type: "induction cooktop", noun: "cooktop", useCases: ["quick cooking","backup to gas","small kitchens","hostel and PG"] },
  { match: /pressure\s+cooker|cooker\b/i, type: "pressure cooker", noun: "cooker", useCases: ["daily dal and rice","curries","one-pot meals","meal prep"] },
  { match: /kadhai|kadai|wok\b|frying\s+pan|frypan|tawa/i, type: "cookware", noun: "pan", useCases: ["daily Indian cooking","stir-fry","shallow frying","everyday meals"] },
  { match: /cookware\s+set|non[- ]?stick\s+set/i, type: "cookware set", noun: "cookware", useCases: ["daily home cooking","new kitchens","gifting to newlyweds","upgrading old pans"] },
  { match: /shoe|sneaker|trainer|loafer|sandal|slipper|flip[- ]?flop/i, type: "footwear", noun: "footwear", useCases: ["daily wear","walking and light workouts","casual outings","office wear"] },
  { match: /t[- ]?shirt|tee\b/i, type: "t-shirt", noun: "t-shirt", useCases: ["daily casual wear","layering","weekend outings","gifting"] },
  { match: /shirt/i, type: "shirt", noun: "shirt", useCases: ["office wear","casual outings","gifting","daily wardrobe"] },
  { match: /jean|trouser|pant|chino/i, type: "bottomwear", noun: "trousers", useCases: ["daily wear","office","casual outings","travel"] },
  { match: /kurta|kurti|saree|salwar|lehenga|ethnic/i, type: "ethnic wear", noun: "outfit", useCases: ["daily ethnic wear","festivals","office","gifting"] },
  { match: /jacket|hoodie|sweatshirt|sweater/i, type: "outerwear", noun: "jacket", useCases: ["cold weather","layering","travel","casual outings"] },
  { match: /perfume|deo|deodorant|body\s+spray|cologne/i, type: "fragrance", noun: "fragrance", useCases: ["daily wear","office","evenings out","gifting"] },
  { match: /shampoo|conditioner|hair\s+oil|hair\s+serum/i, type: "hair care product", noun: "product", useCases: ["daily haircare","weekly deep care","travel-size top-ups","gifting"] },
  { match: /face\s?wash|cleanser|serum|moisturi[sz]er|sunscreen|spf/i, type: "skincare product", noun: "product", useCases: ["daily skincare routine","AM/PM steps","travel","building a starter routine"] },
  { match: /lipstick|foundation|kajal|eyeliner|mascara|compact|makeup/i, type: "makeup product", noun: "product", useCases: ["daily makeup","office looks","evenings out","gifting"] },
  { match: /toy|puzzle|lego|board\s+game/i, type: "toy", noun: "toy", useCases: ["indoor playtime","birthday gifting","screen-free fun","learning through play"] },
  { match: /book|novel|guide/i, type: "book", noun: "book", useCases: ["daily reading","study support","travel reads","gifting"] },
  { match: /yoga\s+mat|exercise\s+mat/i, type: "yoga mat", noun: "mat", useCases: ["home yoga","stretching","light workouts","meditation"] },
  { match: /dumbbell|kettlebell|resistance\s+band|skipping\s+rope/i, type: "fitness accessory", noun: "accessory", useCases: ["home workouts","strength training","warm-ups","travel workouts"] },
  { match: /pillow|cushion|bedsheet|blanket|comforter|mattress/i, type: "home bedding", noun: "bedding", useCases: ["daily use","bedroom refresh","gifting","seasonal change"] },
  { match: /lamp|light|bulb|led/i, type: "lighting", noun: "light", useCases: ["home lighting","bedside use","desk setup","decor"] },
  { match: /vacuum\s+cleaner|robot\s+vacuum/i, type: "vacuum cleaner", noun: "vacuum", useCases: ["daily home cleaning","carpets and rugs","car interiors","pet-friendly homes"] },
  { match: /iron\b|steam\s+iron/i, type: "iron", noun: "iron", useCases: ["daily ironing","office wear","travel","quick touch-ups"] },
  { match: /trimmer|shaver|epilator|hair\s+dryer|straightener/i, type: "grooming appliance", noun: "appliance", useCases: ["daily grooming","travel","quick touch-ups","gifting"] },
];

function analyzeTitle(title: string, category: string): TitleFacts {
  const t = title.replace(/\s+/g, " ").trim();
  const low = t.toLowerCase();

  const capMatch =
    low.match(/(\d+(?:\.\d+)?)\s?(litre|liter|liters|litres|l)\b/i) ||
    low.match(/(\d+(?:\.\d+)?)\s?(ml|milliliter|millilitre)\b/i) ||
    low.match(/(\d+(?:\.\d+)?)\s?(kg|kilogram|g|gram|grams)\b/i) ||
    low.match(/(\d+)\s?(gb|tb)\b/i) ||
    low.match(/(\d+)\s?(mah|w|watt|watts)\b/i);
  const capacity = capMatch
    ? (() => {
        const num = capMatch[1];
        const unit = capMatch[2].toLowerCase();
        const norm =
          /^(litre|liter|liters|litres|l)$/.test(unit) ? "L"
          : /^(ml|milliliter|millilitre)$/.test(unit) ? "ml"
          : /^(kg|kilogram)$/.test(unit) ? "kg"
          : /^(g|gram|grams)$/.test(unit) ? "g"
          : /^(gb)$/.test(unit) ? "GB"
          : /^(tb)$/.test(unit) ? "TB"
          : /^(mah)$/.test(unit) ? "mAh"
          : /^(w|watt|watts)$/.test(unit) ? "W"
          : unit;
        return `${num} ${norm}`;
      })()
    : undefined;

  const sizeMatch =
    low.match(/(\d+(?:\.\d+)?)\s?(inch|inches|"|in)\b/i) ||
    low.match(/(\d+(?:\.\d+)?)\s?(cm|mm)\b/i);
  const size = sizeMatch
    ? `${sizeMatch[1]} ${/^(inch|inches|"|in)$/i.test(sizeMatch[2]) ? "inch" : sizeMatch[2].toLowerCase()}`
    : undefined;

  const packMatch = low.match(/pack\s+of\s+(\d+)|(\d+)\s?[- ]?piece\s+set|set\s+of\s+(\d+)/i);
  const pack = packMatch
    ? `Pack of ${packMatch[1] ?? packMatch[2] ?? packMatch[3]}`
    : undefined;

  const color = COLORS.find((c) => new RegExp(`\\b${c}\\b`, "i").test(low));
  const material = MATERIALS.find((m) => new RegExp(`\\b${m.replace(/[-\s]/g, "[-\\s]")}\\b`, "i").test(low));

  const isMen = /\b(men|man|mens|men's|male|gents)\b/i.test(low);
  const isWomen = /\b(women|woman|womens|women's|female|ladies)\b/i.test(low);
  const isKids = /\b(kids?|child(?:ren)?|baby|babies|infant|toddler|boys?|girls?)\b/i.test(low);
  const audience = isMen && isWomen
    ? "men and women"
    : isMen ? "men"
    : isWomen ? "women"
    : isKids ? "kids"
    : /\bunisex\b/i.test(low) ? "unisex users"
    : undefined;

  const attributes: string[] = [];
  for (const kw of ATTRIBUTE_KEYWORDS) {
    if (new RegExp(`\\b${kw.replace(/[-\s]/g, "[-\\s]?")}\\b`, "i").test(low)) {
      // Normalize wording
      const norm = kw
        .replace(/noise[- ]cancel(l?)ing/i, "noise cancellation")
        .replace(/water[- ]?resistant/i, "water resistance")
        .replace(/leak[- ]?proof/i, "leak resistance")
        .replace(/non[- ]?stick/i, "non-stick");
      if (!attributes.includes(norm)) attributes.push(norm);
    }
  }

  const pt = PRODUCT_TYPES.find((p) => p.match.test(low));
  const productType = pt?.type ?? (category ? category.toLowerCase() : "product");
  const productNoun = pt?.noun ?? "product";
  const useCases = pt?.useCases ?? [];

  return {
    cleanTitle: t,
    productType,
    productNoun,
    capacity,
    size,
    pack,
    color,
    material,
    audience,
    attributes,
    useCases,
  };
}

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
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
  const facts = analyzeTitle(title, category);

  // Build a bank of product-specific sentences derived from facts. These are
  // *only* included when the underlying fact actually exists in the title,
  // which is what keeps content accurate and non-generic.
  const specificFeatures: string[] = [];
  const specificBenefits: string[] = [];
  const specificTips: string[] = [];
  const specificFaqs: { q: string; a: string }[] = [];

  if (facts.capacity) {
    specificFeatures.push(`${facts.capacity} capacity — sized for ${facts.useCases[0] ?? "everyday use"}`);
    specificBenefits.push(`The ${facts.capacity} size hits a practical balance between portability and how much it can hold.`);
    specificTips.push(`Confirm the ${facts.capacity} capacity fits what you plan to carry before ordering.`);
    specificFaqs.push({
      q: `What is the capacity of this ${facts.productNoun}?`,
      a: `Based on the title, this ${facts.productNoun} offers a ${facts.capacity} capacity, which suits ${facts.useCases[0] ?? "typical daily use"}.`,
    });
  }
  if (facts.size) {
    specificFeatures.push(`${facts.size} size, easy to handle and store`);
    specificTips.push(`Measure the space you plan to use it in against the ${facts.size} dimension.`);
  }
  if (facts.pack) {
    specificFeatures.push(`${facts.pack} — more value per order`);
    specificBenefits.push(`Coming as a ${facts.pack.toLowerCase()} makes it easier to share, rotate, or gift.`);
  }
  if (facts.color) {
    specificFeatures.push(`Available in ${facts.color} — a shade that pairs with most existing gear`);
  }
  if (facts.material) {
    specificFeatures.push(`Built using ${facts.material}, chosen for regular use`);
    specificBenefits.push(`The ${facts.material} construction is a step up from throwaway alternatives.`);
    specificFaqs.push({
      q: `What material is this ${facts.productNoun} made of?`,
      a: `The title indicates ${facts.material} construction, which is generally chosen for durability and everyday use.`,
    });
  }
  if (facts.audience) {
    specificFeatures.push(`Designed for ${facts.audience} — inclusive styling for shared use`);
  }
  for (const a of facts.attributes.slice(0, 4)) {
    specificFeatures.push(`${capitalize(a)} — a genuinely useful trait for this kind of product`);
  }

  // Attribute-specific benefits & FAQs for common product cues.
  if (/insulated|thermal|vacuum|double[- ]?wall|hot and cold|hot & cold/i.test(facts.attributes.join(" "))) {
    specificBenefits.push(`Thermal insulation helps keep contents warm or cool through the day, which is the main reason people buy this kind of ${facts.productNoun}.`);
    specificFaqs.push({
      q: `How long does it keep food or drinks hot or cold?`,
      a: `Insulated ${facts.productNoun}s typically hold temperature for several hours. Exact retention varies by brand — check the seller's stated hot/cold duration on the listing.`,
    });
  }
  if (/leak/i.test(facts.attributes.join(" "))) {
    specificBenefits.push(`Leak resistance keeps the inside of your bag safe from spills during commutes.`);
  }
  if (/wireless|bluetooth/i.test(facts.attributes.join(" "))) {
    specificBenefits.push(`Going wireless removes cable clutter and makes it easier to grab and go.`);
  }
  if (/rechargeable/i.test(facts.attributes.join(" "))) {
    specificTips.push(`Charge it fully before first use for the best initial battery cycle.`);
  }
  if (/portable|lightweight|compact|foldable/i.test(facts.attributes.join(" "))) {
    specificBenefits.push(`The compact, portable form factor makes it easy to slip into a bag or a small drawer.`);
  }
  if (/waterproof|water\s*resistance/i.test(facts.attributes.join(" "))) {
    specificFaqs.push({
      q: `Can it handle rain or splashes?`,
      a: `Water resistance is called out in the title, so light rain and accidental splashes are generally fine. Avoid full submersion unless the listing explicitly says otherwise.`,
    });
  }

  // Merge product-specific content with the category vocab, prioritizing
  // specifics. This guarantees the output actually references the title.
  const mergedFeatures = dedupe([...specificFeatures, ...v.featurePool]);
  const mergedBenefits = dedupe([...specificBenefits, ...v.benefitPool]);
  const mergedTips = dedupe([...specificTips, ...v.tipPool]);
  const mergedFaqs = dedupeFaqs([...specificFaqs, ...v.faqPool]);

  const adj = pick(r, v.adjectives);
  const useCase = facts.useCases[0] ?? pick(r, v.useCases);
  const useCase2 = facts.useCases[1] ?? pick(r, v.useCases);
  const audience = pick(r, v.audiences);
  const audience2 = facts.audience ?? pick(r, v.audiences);

  // Keep specifics up front (in stable order) then top up with shuffled generic
  // ones so the length still lands in the 5-7 / 3-5 targets.
  const targetFeatureCount = 5 + Math.floor(r() * 3);
  const targetBenefitCount = 3 + Math.floor(r() * 2);
  const targetTipCount = 3 + Math.floor(r() * 2);
  const features = topUp(mergedFeatures, specificFeatures, r, targetFeatureCount);
  const benefits = topUp(mergedBenefits, specificBenefits, r, targetBenefitCount);
  const tips = topUp(mergedTips, specificTips, r, targetTipCount);
  const faqs = topUpFaqs(mergedFaqs, specificFaqs, r, 3);

  // Build a product-specific summary line used inside the description.
  const detailBits: string[] = [];
  if (facts.capacity) detailBits.push(`${facts.capacity} capacity`);
  if (facts.size) detailBits.push(`${facts.size} size`);
  if (facts.material) detailBits.push(`${facts.material} build`);
  if (facts.color) detailBits.push(`${facts.color} finish`);
  if (facts.pack) detailBits.push(facts.pack.toLowerCase());
  if (facts.audience) detailBits.push(`suited for ${facts.audience}`);
  const detailSentence =
    detailBits.length > 0
      ? `Going by the title, key specifics include ${joinList(detailBits)}.`
      : "";
  const attrSentence =
    facts.attributes.length > 0
      ? `It's described as ${joinList(facts.attributes.slice(0, 4))}, which shapes how it fits into everyday use.`
      : "";
  const usageSentence = facts.useCases.length
    ? `Common day-to-day scenarios include ${joinList(facts.useCases.slice(0, 3))}.`
    : "";

  // Build a 150-250 word description using multiple mixed sentence templates.
  const openers = [
    `The ${t} is a ${facts.productType} aimed at buyers who want a ${adj} option without overspending.`,
    `As a ${facts.productType}, the ${t} lines up neatly with what most buyers actually shop for in this space.`,
    `If you've been comparing ${facts.productType} options, the ${t} is worth a serious look right now.`,
    `The ${t} focuses on the essentials most people care about in a ${facts.productType} — practical design, sensible specs, and a fair price.`,
  ];
  const middles = [
    `It's built with ${useCase} in mind, so it fits into real routines instead of only looking good in photos.`,
    `Whether you're using it for ${useCase} or ${useCase2}, it holds up without demanding a lot of attention.`,
    `Designed around ${useCase}, it keeps the experience simple — pick it up, use it, and move on.`,
  ];
  const priceLine =
    discountPct >= 65
      ? `At the current discount of around ${discountPct}%, this is one of the sharper price drops we've seen for this kind of product.`
      : discountPct >= 40
        ? `With about ${discountPct}% off right now, the pricing lands in a genuinely attractive zone versus the usual MRP.`
        : `Even at a modest discount, the current price is worth checking against your usual online source before you decide.`;
  const closers = [
    `Overall, the ${t} is a sensible ${facts.productNoun} for ${audience2 || audience} who want to buy once and move on.`,
    `In short, it's a straightforward ${facts.productNoun} recommendation for ${audience2 || audience}.`,
    `Bottom line: if you're a fit for the description above, the ${t} deserves a spot on your shortlist.`,
  ];

  const description = [
    pick(r, openers),
    detailSentence,
    attrSentence,
    pick(r, middles),
    usageSentence,
    priceLine,
    `On the practical side, expect ${features[0].toLowerCase()}${features[1] ? ` and ${features[1].toLowerCase()}` : ""} — the kind of details that quietly matter every day.`,
    `It also earns points for ${benefits[0].toLowerCase()}, which is exactly why buyers keep coming back to picks like this one.`,
    pick(r, closers),
  ].filter(Boolean).join(" ");

  const whoShouldBuy = `The ${t} is a strong fit for ${facts.audience ?? audience} looking for a ${adj} ${facts.productType}, and equally suited to ${audience2 || audience} who prefer buys that quietly work day after day. It's especially worth a look if ${useCase} is a regular part of your routine.`;

  // Meta description: 150-160 chars, unique per title
  const metaBits = [
    facts.capacity ? facts.capacity : "",
    facts.color ? facts.color : "",
    facts.material ? facts.material : "",
  ].filter(Boolean).join(" ");
  const metaBase = metaBits
    ? `${t} at ${discountPct}% off — ${metaBits} ${facts.productType}. Features, FAQs and price-drop alerts on CheckThePrice.`
    : `${t} at ${discountPct}% off — features, buying tips, FAQs and price-drop alerts for this ${facts.productType} on CheckThePrice.`;
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

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const k = s.toLowerCase().trim();
    if (!seen.has(k)) { seen.add(k); out.push(s); }
  }
  return out;
}
function dedupeFaqs(arr: { q: string; a: string }[]): { q: string; a: string }[] {
  const seen = new Set<string>();
  const out: { q: string; a: string }[] = [];
  for (const f of arr) {
    const k = f.q.toLowerCase().trim();
    if (!seen.has(k)) { seen.add(k); out.push(f); }
  }
  return out;
}
function topUp(
  merged: string[],
  specific: string[],
  r: () => number,
  target: number,
): string[] {
  const spec = specific.slice(0, target);
  const remaining = merged.filter((x) => !spec.includes(x));
  const shuffled = shuffle(r, remaining);
  return dedupe([...spec, ...shuffled]).slice(0, target);
}
function topUpFaqs(
  merged: { q: string; a: string }[],
  specific: { q: string; a: string }[],
  r: () => number,
  target: number,
): { q: string; a: string }[] {
  const spec = specific.slice(0, target);
  const remaining = merged.filter((x) => !spec.some((s) => s.q === x.q));
  const shuffled = shuffle(r, remaining);
  return dedupeFaqs([...spec, ...shuffled]).slice(0, target);
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
  // v2 bumps cache so older, less-specific content regenerates with the new analyzer.
  return `ctp:seo:v2:${hashSeed(`${title}|${category}`).toString(36)}`;
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