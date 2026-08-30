export type ReelProduct = {
  id: string;
  title: string;
  image: string;
  category: string;
  price: number;
  mrp?: number | null;
  discount_percentage?: number | null;
  source?: string | null;
  standard_link?: string | null;
  affiliate_link?: string | null;
};

export type ReelConceptKey =
  | "fashion"
  | "footwear"
  | "handbags"
  | "wearables"
  | "beauty"
  | "kitchen"
  | "home"
  | "electronics"
  | "sports"
  | "festivals"
  | "other";
