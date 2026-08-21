import { normalizeCategory } from "@/lib/categories";

/**
 * Classify a product from its title when the title contains a clear product
 * type. This is intentionally conservative: ambiguous titles fall back to the
 * scraped marketplace category instead of guessing.
 */
export function classifyProductCategory(
  title: string,
  scrapedCategory: string | null | undefined,
): string {
  const text = title
    .toLowerCase()
    .replace(/[^a-z0-9&' -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const titleRules: Array<{ category: string; patterns: RegExp[] }> = [
    {
      category: "Kitchen",
      patterns: [
        /\bvegetable\s+peeler\b/, /\bpotato\s+peeler\b/, /\bpeeler\b/,
        /\bchopper\b/, /\bgrater\b/, /\bmandoline\b/, /\bcolander\b/,
        /\bstrainer\b/, /\bspatula\b/, /\btongs?\b/, /\bknife\b/,
        /\bknives\b/, /\bcutlery\b/, /\brolling\s+pin\b/, /\bchopping\s+board\b/,
        /\bcutting\s+board\b/, /\bvegetable\s+cutter\b/, /\bcorn\s+cutter\b/,
        /\bcorn\s+stripper\b/, /\bgarlic\s+press\b/, /\bmasher\b/, /\bwhisk\b/,
        /\bkitchen\b/, /\bcookware\b/, /\bpressure\s+cooker\b/, /\bair\s+fryer\b/,
        /\bmixer\s+grinder\b/, /\belectric\s+kettle\b/, /\bdinner\s+set\b/,
        /\blunch\s+box\b/,
      ],
    },
    {
      category: "Beauty",
      patterns: [
        /\btoothpaste\b/, /\btoothbrush\b/, /\bmouthwash\b/, /\bdental\s+floss\b/,
        /\bshampoo\b/, /\bconditioner\b/, /\bface\s+wash\b/, /\bfacewash\b/,
        /\bmoisturizer\b/, /\bmoisturiser\b/, /\bsunscreen\b/, /\bserum\b/,
        /\bdeodorant\b/, /\bperfume\b/, /\bbody\s+wash\b/, /\bsoap\b/,
        /\bface\s+cream\b/, /\bhair\s+oil\b/, /\bhair\s+dryer\b/, /\btrimmer\b/,
        /\bshaver\b/, /\brazor\b/, /\bmakeup\b/, /\bcosmetic\b/, /\bskincare\b/,
      ],
    },
    {
      category: "Fashion",
      patterns: [
        /\brakhi\b/, /\bsaree\b/, /\bsari\b/, /\bkurta\b/, /\bkurti\b/,
        /\bdress\b/, /\bshirt\b/, /\bt-?shirt\b/, /\bjeans\b/, /\btrousers\b/,
        /\bshoes?\b/, /\bsneakers?\b/, /\bsandals?\b/, /\bhandbag\b/,
        /\bbackpack\b/, /\bwallet\b/, /\bbelt\b/, /\bsunglasses\b/,
      ],
    },
    {
      category: "Home & Furniture",
      patterns: [
        /\bbean\s*bag\b/, /\bsofa\b/, /\bchair\b/, /\btable\b/, /\bbed\b/,
        /\bmattress\b/, /\bpillow\b/, /\bcushion\b/, /\bbedsheet\b/,
        /\bcurtain\b/, /\bcarpet\b/, /\brug\b/, /\bmandir\b/, /\bpooja\s+mandir\b/,
        /\bwall\s+decor\b/, /\bhome\s+decor\b/, /\bwall\s+clock\b/,
      ],
    },
    {
      category: "Electronics",
      patterns: [
        /\bsmartphone\b/, /\bmobile\s+phone\b/, /\btablet\b/, /\btelevision\b/, /\bsmart\s+tv\b/,
        /\bheadphones?\b/, /\bearbuds?\b/, /\bearphones?\b/, /\bspeaker\b/, /\bsoundbar\b/,
        /\bpower\s+bank\b/, /\bcharger\b/, /\bcamera\b/, /\bgaming\s+console\b/,
      ],
    },
    {
      category: "Home Appliances",
      patterns: [
        /\brefrigerator\b/, /\bfridge\b/, /\bwashing\s+machine\b/, /\bair\s+conditioner\b/,
        /\bair\s+cooler\b/, /\bair\s+purifier\b/, /\bvacuum\s+cleaner\b/, /\bgeyser\b/,
      ],
    },
    {
      category: "Sports & Fitness",
      patterns: [
        /\bsleeping\s+bag\b/, /\btent\b/, /\bcamping\s+gear\b/, /\bfitness\b/,
        /\byoga\b/, /\bdumbbell\b/, /\bcricket\b/, /\bfootball\b/, /\btennis\b/,
        /\bbadminton\b/, /\bbicycle\b/, /\bcycling\b/, /\bcycle\b/, /\bsports?\b/,
      ],
    },
    {
      category: "Other",
      patterns: [
        /\b(?:motorcycle|motorbike|scooter)\s+cover\b/,
        /\b(?:bike|scooter)\s+body\s+cover\b/,
      ],
    },
  ];

  for (const rule of titleRules) {
    if (rule.patterns.some((pattern) => pattern.test(text))) return rule.category;
  }

  return normalizeCategory(scrapedCategory);
}
