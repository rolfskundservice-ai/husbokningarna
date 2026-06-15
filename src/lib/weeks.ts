import {
  startOfISOWeek,
  endOfISOWeek,
  getISOWeek,
  getISOWeekYear,
  addWeeks,
  format,
} from "date-fns";

/**
 * Stugorna hyrs ut veckovis (ISO-vecka, mån-sön).
 * En "vecka" representeras internt som ett datumintervall
 * [startDate, endDate) där endDate är start på nästa vecka (exklusiv).
 */
export interface WeekInfo {
  weekNumber: number;
  year: number;
  startDate: Date; // måndag 00:00
  endDate: Date; // nästa måndag 00:00 (exklusiv)
  label: string; // "Vecka 24, 2026"
}

export function getWeekInfo(date: Date): WeekInfo {
  const start = startOfISOWeek(date);
  const end = addWeeks(start, 1);
  return {
    weekNumber: getISOWeek(date),
    year: getISOWeekYear(date),
    startDate: start,
    endDate: end,
    label: `Vecka ${getISOWeek(date)}, ${getISOWeekYear(date)}`,
  };
}

/** Genererar en lista av veckor (start/end-datum) för en period framåt */
export function getWeeksInRange(from: Date, weeksCount: number): WeekInfo[] {
  const weeks: WeekInfo[] = [];
  let cursor = startOfISOWeek(from);
  for (let i = 0; i < weeksCount; i++) {
    weeks.push(getWeekInfo(cursor));
    cursor = addWeeks(cursor, 1);
  }
  return weeks;
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), "yyyy-MM-dd");
}
