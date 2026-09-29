export type BudgetRecommendation = {
  title: string;
  price: number;
  store: "Amazon" | "Flipkart";
  url: string;
  buyUrl: string;
};

export type BudgetDiscoveryResult = {
  products: BudgetRecommendation[];
  error: string | null;
};