"use client";

import { useEffect, useState } from "react";
import { getISOWeek } from "date-fns";

interface Property {
  id: string;
  name: string;
  color: string;
}

interface Booking {
  id: string;
  propertyId: string;
  startDate: string;
  endDate: string; // exclusive
  guestName: string | null;
  userName: string | null;
  notes: string | null;
  numberOfPersons: number | null;
  numberOfBoats: number | null;
  cleaning: boolean;
  bedLinen: boolean;
  source: "INTERNAL" | "AIRBNB" | "MANUAL";
}

interface Week {
  weekNumber: number;
  year: number;
  start: Date;
  end: Date; // exclusive
}

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function generateWeeks(from: Date, count: number): Week[] {
  const monday = getMondayOf(from);
  return Array.from({ length: count }, (_, w) => {
    const start = new Date(monday);
    start.setDate(monday.getDate() + w * 7);
    const end = addDays(start, 7);
    return { weekNumber: getISOWeek(start), year: start.getFullYear(), start, end };
  });
}

function parseLocalDate(isoStr: string): Date {
  const [y, m, d] = isoStr.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtDate(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function formatRange(startStr: string, endStr: string): string {
  const lastDay = addDays(parseLocalDate(endStr), -1);
  return `${fmtDate(parseLocalDate(startStr))}–${fmtDate(lastDay)}`;
}

type WeekState =
  | { type: "empty" }
  | { type: "start"; booking: Booking }
  | { type: "continues"; booking: Booking };

function getWeekState(propertyId: string, week: Week, bookings: Booking[]): WeekState {
  for (const b of bookings) {
    if (b.propertyId !== propertyId) continue;
    const start = parseLocalDate(b.startDate);
    const end = parseLocalDate(b.endDate);

    if (start >= week.start && start < week.end) return { type: "start", booking: b };
    if (start < week.start && end > week.start) return { type: "continues", booking: b };
  }
  return { type: "empty" };
}

function sourceColor(source: string): { bg: string; border: string; text: string } {
  if (source === "AIRBNB")
    return { bg: "rgba(249,115,22,0.25)", border: "rgba(249,115,22,0.5)", text: "#fed7aa" };
  return { bg: "rgba(59,130,246,0.22)", border: "rgba(59,130,246,0.45)", text: "#bfdbfe" };
}

export function OverviewCalendar({ properties }: { properties: Property[] }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [weeksAhead, setWeeksAhead] = useState(26);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (properties.length === 0) return;
    setLoading(true);

    const today = new Date();
    const monday = getMondayOf(today);
    const endDate = addDays(monday, weeksAhead * 7);
    const from = monday.toISOString().slice(0, 10);
    const to = endDate.toISOString().slice(0, 10);

    fetch(`/api/bookings?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((data) => {
        setBookings(data);
        setWeeks(generateWeeks(today, weeksAhead));
        setLoading(false);
      });
  }, [properties, weeksAhead]);

  function handleExport() {
    if (!weeks.length) return;
    const from = weeks[0].start.toISOString().slice(0, 10);
    const to = weeks[weeks.length - 1].end.toISOString().slice(0, 10);
    window.location.href = `/api/export?from=${from}&to=${to}`;
  }

  return (
    <div>
      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <LegendDot bg="rgba(59,130,246,0.35)" label="Internbokning" />
          <LegendDot bg="rgba(249,115,22,0.35)" label="Airbnb" />
          <LegendDot bg="rgba(59,130,246,0.12)" label="Fortsätter från föregående vecka" />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={weeksAhead}
            onChange={(e) => setWeeksAhead(Number(e.target.value))}
            className="rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <option value={16}>16 veckor</option>
            <option value={26}>26 veckor</option>
            <option value={52}>52 veckor</option>
          </select>
          <button
            onClick={handleExport}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
            style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}
          >
            ↓ Exportera CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-600">Laddar översikt…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <table className="border-collapse text-xs" style={{ minWidth: properties.length * 380 + 60 }}>
            {/* ── Header ── */}
            <thead>
              {/* Property name row */}
              <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <th
                  className="py-3 pl-4 pr-3 text-left font-semibold text-gray-600 select-none sticky left-0 z-10"
                  style={{ background: "rgba(10,13,20,0.98)", width: 52 }}
                >
                  V.
                </th>
                {properties.map((p) => (
                  <th
                    key={p.id}
                    colSpan={5}
                    className="py-3 px-2 text-center font-bold text-white tracking-wide"
                    style={{ borderLeft: `3px solid ${p.color}` }}
                  >
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-xs"
                      style={{ background: `${p.color}22`, color: p.color }}
                    >
                      {p.name}
                    </span>
                  </th>
                ))}
              </tr>
              {/* Sub-column labels */}
              <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <th className="sticky left-0 z-10" style={{ background: "rgba(10,13,20,0.98)" }} />
                {properties.map((p) => (
                  <>
                    <SubHeader key={`${p.id}-datum`} label="Datum" first color={p.color} />
                    <SubHeader key={`${p.id}-pers`} label="Pers." />
                    <SubHeader key={`${p.id}-batar`} label="Båtar" />
                    <SubHeader key={`${p.id}-ovrigt`} label="Övrigt" wide />
                    <SubHeader key={`${p.id}-bokare`} label="Bokare" />
                  </>
                ))}
              </tr>
            </thead>

            {/* ── Body ── */}
            <tbody>
              {weeks.map((week, wi) => {
                const states = properties.map((p) => getWeekState(p.id, week, bookings));
                const hasAny = states.some((s) => s.type !== "empty");

                // Show month separator
                const isFirstWeekOfMonth = week.start.getDate() <= 7;
                const prevWeek = weeks[wi - 1];
                const monthChanged = !prevWeek || prevWeek.start.getMonth() !== week.start.getMonth();

                return (
                  <>
                    {monthChanged && (
                      <tr key={`month-${wi}`}>
                        <td
                          colSpan={properties.length * 5 + 1}
                          className="pt-4 pb-1 pl-4 text-[11px] font-bold tracking-widest uppercase select-none"
                          style={{
                            color: "rgba(255,255,255,0.3)",
                            borderTop: wi > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                          }}
                        >
                          {week.start.toLocaleDateString("sv-SE", { month: "long", year: "numeric" })}
                        </td>
                      </tr>
                    )}
                    <tr
                      key={`${week.year}-${week.weekNumber}`}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        background: hasAny ? "transparent" : "transparent",
                      }}
                    >
                      {/* Week number */}
                      <td
                        className="py-2 pl-4 pr-3 font-bold text-gray-600 align-middle select-none sticky left-0 z-10 whitespace-nowrap"
                        style={{ background: "rgba(10,13,20,0.98)", verticalAlign: "middle" }}
                      >
                        {week.weekNumber}
                      </td>

                      {/* Property cells */}
                      {properties.map((p, pi) => {
                        const state = states[pi];
                        if (state.type === "empty") {
                          return (
                            <>
                              <EmptyCell key={`${p.id}-datum`} first color={p.color} />
                              <EmptyCell key={`${p.id}-pers`} />
                              <EmptyCell key={`${p.id}-batar`} />
                              <EmptyCell key={`${p.id}-ovrigt`} />
                              <EmptyCell key={`${p.id}-bokare`} />
                            </>
                          );
                        }

                        const { booking } = state;
                        const sc = sourceColor(booking.source);
                        const isContinuation = state.type === "continues";
                        const bg = isContinuation
                          ? sc.bg.replace("0.22", "0.10").replace("0.25", "0.12")
                          : sc.bg;
                        const border = isContinuation ? "transparent" : sc.border;
                        const textColor = isContinuation
                          ? sc.text.replace("bfdbfe", "93a8c4").replace("fed7aa", "c4a47a")
                          : sc.text;

                        const cellStyle = {
                          background: bg,
                          color: textColor,
                          paddingTop: 6,
                          paddingBottom: 6,
                          verticalAlign: "middle" as const,
                        };

                        return (
                          <>
                            <td
                              key={`${p.id}-datum`}
                              className="px-2 font-semibold whitespace-nowrap"
                              style={{
                                ...cellStyle,
                                borderLeft: `3px solid ${isContinuation ? "transparent" : p.color}`,
                              }}
                            >
                              {isContinuation ? (
                                <span className="opacity-50">↓</span>
                              ) : (
                                formatRange(booking.startDate, booking.endDate)
                              )}
                            </td>
                            <td key={`${p.id}-pers`} className="px-2 text-center" style={cellStyle}>
                              {!isContinuation && booking.numberOfPersons != null
                                ? booking.numberOfPersons
                                : ""}
                            </td>
                            <td key={`${p.id}-batar`} className="px-2 text-center" style={cellStyle}>
                              {!isContinuation && (booking.numberOfBoats ?? 0) > 0
                                ? booking.numberOfBoats
                                : ""}
                            </td>
                            <td
                              key={`${p.id}-ovrigt`}
                              className="px-2 max-w-[160px]"
                              style={{ ...cellStyle, whiteSpace: "normal" }}
                            >
                              {!isContinuation ? [
                                booking.cleaning && "Städning",
                                booking.bedLinen && "Lakan",
                                booking.notes,
                              ].filter(Boolean).join(", ") : ""}
                            </td>
                            <td key={`${p.id}-bokare`} className="px-2 whitespace-nowrap" style={cellStyle}>
                              {!isContinuation
                                ? booking.guestName || booking.userName || (booking.source === "AIRBNB" ? "Airbnb" : "")
                                : ""}
                            </td>
                          </>
                        );
                      })}
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SubHeader({ label, first, color, wide }: { label: string; first?: boolean; color?: string; wide?: boolean }) {
  return (
    <th
      className="py-2 px-2 text-left font-medium text-gray-600 whitespace-nowrap"
      style={{
        borderLeft: first && color ? `3px solid ${color}` : "1px solid rgba(255,255,255,0.05)",
        minWidth: wide ? 130 : label === "Datum" ? 90 : 52,
      }}
    >
      {label}
    </th>
  );
}

function EmptyCell({ first, color }: { first?: boolean; color?: string }) {
  return (
    <td
      style={{
        borderLeft: first && color ? `3px solid rgba(255,255,255,0.04)` : "1px solid rgba(255,255,255,0.03)",
        paddingTop: 6,
        paddingBottom: 6,
      }}
    />
  );
}

function LegendDot({ bg, label }: { bg: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-4 rounded-sm inline-block" style={{ background: bg }} />
      {label}
    </span>
  );
}
