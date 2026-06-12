export type DiscountRangeId = "0-25" | "25-50" | "50-75" | "75-90" | "90-100";

export interface DiscountRange {
  id: DiscountRangeId;
  label: string;
  min: number; // inclusive
  max: number; // exclusive (except last which is inclusive to 100)
}

export const DISCOUNT_RANGES: DiscountRange[] = [
  { id: "0-25", label: "0% – 25% OFF", min: 0, max: 25 },
  { id: "25-50", label: "25% – 50% OFF", min: 25, max: 50 },
  { id: "50-75", label: "50% – 75% OFF", min: 50, max: 75 },
  { id: "75-90", label: "75% – 90% OFF", min: 75, max: 90 },
  { id: "90-100", label: "90%+ OFF", min: 90, max: 101 },
];

export function inDiscountRange(
  discount: number,
  id: DiscountRangeId,
): boolean {
  const r = DISCOUNT_RANGES.find((x) => x.id === id);
  if (!r) return true;
  return discount >= r.min && discount < r.max;
}

export function discountRangeLabel(id: DiscountRangeId): string {
  return DISCOUNT_RANGES.find((r) => r.id === id)?.label ?? "";
}