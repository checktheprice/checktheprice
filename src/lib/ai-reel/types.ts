export type AIReelProduct = {
  id: string;
  title: string;
  category: string;
  price: number | string;
  mrp: number | string | null;
  image: string | null;
  source: string | null;
};

export type AIReelStatus = {
  done: boolean;
  failed: boolean;
  error?: string;
  downloadUrl?: string;
};
