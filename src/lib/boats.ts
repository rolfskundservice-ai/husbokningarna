export const BOAT_TYPES = [
  { id: "boat6hp",  label: "6 hk",   total: 2, weekPrice: 1750 },
  { id: "boat99hp", label: "9,9 hk", total: 2, weekPrice: 2250 },
  { id: "boat20hp", label: "20 hk",  total: 2, weekPrice: 2750 },
  { id: "boat25hp", label: "25 hk",  total: 1, weekPrice: 3250 },
] as const;

export type BoatId = "boat6hp" | "boat99hp" | "boat20hp" | "boat25hp";

export interface BoatCounts {
  boat6hp: number;
  boat99hp: number;
  boat20hp: number;
  boat25hp: number;
}

export function boatPrice(weekPrice: number, nights: number): number {
  const raw = (weekPrice / 7) * nights;
  return Math.round(raw / 50) * 50;
}

export function totalBoats(b: BoatCounts): number {
  return b.boat6hp + b.boat99hp + b.boat20hp + b.boat25hp;
}

export function boatSummary(b: BoatCounts): string {
  return BOAT_TYPES
    .filter(t => b[t.id as BoatId] > 0)
    .map(t => `${b[t.id as BoatId]}× ${t.label}`)
    .join(", ") || "–";
}
