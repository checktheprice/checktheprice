import type { ReelConceptKey, ReelProduct } from "./types";

const conceptMatchers: Array<[ReelConceptKey, RegExp]> = [
  ["fashion", /fashion|clothing|apparel|dress|shirt|t-?shirt|kurta|saree|jeans|top|jacket|ethnic/i],
  ["footwear", /footwear|shoe|shoes|sneaker|sandal|sandals|chappal|slipper|heels|boots/i],
  ["handbags", /handbag|hand bag|bag|purse|wallet|tote|clutch/i],
  ["wearables", /wearable|smart ?watch|watch|fitness band|tracker/i],
  ["beauty", /beauty|makeup|cosmetic|skincare|skin care|hair|grooming|perfume/i],
  ["kitchen", /kitchen|cook|cooking|cookware|appliance|utensil|mixer|bottle|lunch/i],
  ["home", /home|furniture|decor|mattress|bedsheet|sofa|chair|table|lamp|storage/i],
  ["electronics", /electronics|mobile|phone|laptop|tablet|camera|headphone|earbud|speaker|charger|power bank/i],
  ["sports", /sports|fitness|gym|yoga|cycle|bicycle|cricket|football|exercise/i],
  ["festivals", /festival|festive|diwali|rakhi|holi|christmas|eid|puja|wedding/i],
];

export function classifyReelConcept(category: string, title = ""): ReelConceptKey {
  const text = `${category} ${title}`;
  return conceptMatchers.find(([, matcher]) => matcher.test(text))?.[0] ?? "other";
}

function actionForConcept(concept: ReelConceptKey): string {
  switch (concept) {
    case "fashion":
      return "A realistic fashion model wears and naturally shows the clothing in a modern Instagram fashion reel, with confident poses and close-up fabric/detail shots.";
    case "footwear":
      return "A realistic model wears the footwear, walks and poses naturally, with tasteful close-ups of the feet so the shoes/sandals/chappals remain recognizable.";
    case "handbags":
      return "A realistic fashion model carries the handbag in a lifestyle setting, opening, holding, and styling it naturally without changing its look.";
    case "wearables":
      return "A realistic person wears and uses the smartwatch or wearable, tapping the screen and checking it during an active lifestyle moment.";
    case "beauty":
      return "A realistic person demonstrates or applies the beauty product appropriately in a clean vanity or lifestyle setting.";
    case "kitchen":
      return "A person naturally uses the kitchen product in a bright kitchen while preparing food or organizing the counter.";
    case "home":
      return "A realistic home or lifestyle scene displays the product being used naturally as part of a tasteful room setup.";
    case "electronics":
      return "A person naturally interacts with the electronic product in a clean lifestyle or desk setup, demonstrating realistic use without showing unverified features.";
    case "sports":
      return "A person naturally uses the product in an appropriate sports or fitness environment with energetic but realistic motion.";
    case "festivals":
      return "An appropriate festive lifestyle scene presents the product naturally with warm celebration lighting and tasteful decor.";
    default:
      return "An attractive realistic product and lifestyle commercial shows the product being used or displayed naturally in context.";
  }
}

export function buildReelPrompt(product: ReelProduct): { concept: ReelConceptKey; prompt: string } {
  const concept = classifyReelConcept(product.category, product.title);
  const priceText = product.price ? `Current deal price: ₹${product.price}.` : "";
  const mrpText = product.mrp ? `MRP: ₹${product.mrp}.` : "";
  const discountText = product.discount_percentage ? `Discount: ${product.discount_percentage}%.` : "";
  const marketplaceText = product.source ? `Marketplace: ${product.source}.` : "";

  return {
    concept,
    prompt: [
      "Create a vertical 9:16 Instagram Reel / YouTube Short style promotional video for the exact product shown in the supplied reference image.",
      actionForConcept(concept),
      "Preserve the actual product appearance, colors, shape, logos, materials, and visible details as accurately as possible. Do not replace it with a different or generic product.",
      "Use realistic lighting, natural hand/body movement, smooth camera motion, and premium social-commerce styling. No text overlays, no captions, no fake badges, and no invented claims or specifications.",
      `Product title: ${product.title}.`,
      `Category: ${product.category || "Other"}.`,
      priceText,
      mrpText,
      discountText,
      marketplaceText,
      product.standard_link ? `Product URL for context only: ${product.standard_link}.` : "",
      "Keep the scene brand-safe, adult models only when people are shown, and focus on realistic use/demonstration of the product.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
