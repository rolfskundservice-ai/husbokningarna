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

// Fasta båtnummer 1–7 per typ
export const BOAT_SLOTS: Record<BoatId, number[]> = {
  boat6hp:  [1, 2],
  boat99hp: [3, 4],
  boat20hp: [5, 6],
  boat25hp: [7],
};

// Fast veckopris för 1–7 nätter; dag-tillägg för varje natt utöver 7
export function boatPrice(weekPrice: number, nights: number): number {
  if (nights <= 7) return weekPrice;
  const extra = (nights - 7) * (weekPrice / 7);
  return Math.round((weekPrice + extra) / 50) * 50;
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

// Tilldela specifika båtnummer givet vad som redan är taget
export function assignBoatNumbers(wants: BoatCounts, takenNumbers: number[]): number[] {
  const assigned: number[] = [];
  for (const t of BOAT_TYPES) {
    const id = t.id as BoatId;
    let given = 0;
    for (const slot of BOAT_SLOTS[id]) {
      if (given >= wants[id]) break;
      if (!takenNumbers.includes(slot)) {
        assigned.push(slot);
        given++;
      }
    }
  }
  return assigned;
}

// Parsa lagrad sträng "1,5,7" → [1, 5, 7]
export function parseBoatNumbers(s: string): number[] {
  return s ? s.split(",").map(Number).filter(Boolean) : [];
}

// Formatera för visning: [5, 6] → "Båt 5, Båt 6"
export function formatBoatNumbers(nums: number[]): string {
  return nums.map(n => `Båt ${n}`).join(", ") || "–";
}
