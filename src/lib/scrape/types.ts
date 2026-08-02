export interface Extracted {
  title: string | null;
  category: string | null;
  price: number | null;
  mrp: number | null;
  image: string | null;
}

export function cleanText(s: string | undefined | null): string | null {
  if (!s) return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > 0 ? t : null;
}

// "₹52,400.00" / "52,400" -> 52400
export function parseInr(s: string | undefined | null): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}
