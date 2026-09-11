export function buildAIReelPrompt(category: string, title: string): string {
  const base = `Create a realistic, premium Instagram Reel / YouTube Short promotional video for the exact product shown in the supplied product image. Product: ${title}. Category: ${category}. Preserve the product's recognizable design, colors, shape, branding and important physical details. Do not replace it with a different product. Do not invent product specifications or make unsupported claims. Vertical 9:16 composition, realistic human movement, natural lighting, polished social-media commercial look, energetic but believable camera movement, clean uncluttered scenes, no captions or logos generated inside the video.`;

  const sceneByCategory: Record<string, string> = {
    Fashion: "Show an adult Indian fashion model naturally wearing or styling the referenced product in a stylish everyday setting. Include a confident walk, natural posing and tasteful close-up product details.",
    Footwear: "Show an adult Indian model actually wearing the referenced footwear. Include natural walking and posing shots, with close-ups of the shoes/chappals/sandals while moving.",
    "Home & Furniture": "Show the referenced product naturally used or displayed in a tasteful modern home lifestyle setting, with realistic human interaction where appropriate.",
    Handbags: "Show an adult Indian fashion model naturally carrying and using the referenced handbag in a stylish lifestyle setting, with close-ups of the bag and natural movement.",
    Wearables: "Show an adult Indian person naturally wearing and using the referenced wearable, with close-ups that keep the product recognizable.",
    Beauty: "Show an adult person naturally demonstrating or using the referenced beauty product in a clean, realistic lifestyle setting. Avoid medical claims.",
    Kitchen: "Show a person naturally using the referenced kitchen product while preparing food in a realistic modern kitchen. Keep the product recognizable.",
    Electronics: "Show a person naturally interacting with and using the referenced electronic product in a realistic modern setting. Keep the exact product recognizable.",
    "Sports & Fitness": "Show an adult person naturally using the referenced sports or fitness product in an appropriate realistic activity setting.",
    "Toys & Baby": "Show an appropriate safe family lifestyle scene featuring the referenced product naturally. Do not depict unsafe use.",
    Festivals: "Show an attractive Indian festival/lifestyle setting where the referenced product is naturally worn, displayed or used, depending on the product.",
    Audio: "Show a person naturally using the referenced audio product in a modern lifestyle setting, with appealing close-up product shots.",
    Mobiles: "Show a person naturally using the referenced mobile phone in a modern lifestyle setting, with clean close-ups of the exact device.",
    Laptops: "Show a person naturally using the referenced laptop in a modern work or study setting, with close-ups of the exact device.",
    "Computer Accessories": "Show a person naturally using the referenced computer accessory at a modern desk setup, keeping the exact product recognizable.",
    "Home Appliances": "Show a person naturally using the referenced home appliance in a realistic home setting.",
    Grocery: "Show the referenced grocery product naturally presented or used in an appropriate everyday food/lifestyle scene.",
    Books: "Show a person naturally reading or interacting with the referenced book in an attractive lifestyle setting.",
    Other: "Create an attractive realistic lifestyle/product commercial showing the referenced product naturally being used or showcased.",
  };

  return `${base} ${sceneByCategory[category] ?? sceneByCategory.Other} End with a visually clean product-focused moment suitable for adding a CheckThePrice call-to-action later.`;
}
