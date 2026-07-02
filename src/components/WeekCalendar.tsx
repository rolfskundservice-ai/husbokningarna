"use client";

import { useEffect, useState, useCallback } from "react";
import { getISOWeek } from "date-fns";
import { BOAT_TYPES, BoatId, boatPrice } from "@/lib/boats";

export interface Booking {
  id: string;
  startDate: string;
  endDate: string;
  guestName: string | null;
  userName: string | null;
  notes: string | null;
  numberOfPersons: number | null;
  numberOfBoats: number | null; // computed sum, for display
  boat6hp: number;
  boat99hp: number;
  boat20hp: number;
  boat25hp: number;
  cleaning: boolean;
  bedLinen: boolean;
  source: "INTERNAL" | "AIRBNB" | "MANUAL";
}

interface WeekRow {
  weekNumber: number;
  year: number;
  days: Date[];
}

type DayStatus = "available" | "booked_internal" | "booked_airbnb" | "past" | "today";

const MONTHS_SV = ["januari","februari","mars","april","maj","juni","juli","augusti","september","oktober","november","december"];
const MONTHS_SHORT = ["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"];
const DAY_NAMES = ["Mån","Tis","Ons","Tor","Fre","Lör","Sön"];

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Parse ISO date string as local midnight (avoids UTC-offset shifting dates)
function parseLocalDate(isoStr: string): Date {
  const [y, m, d] = isoStr.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function generateWeeks(from: Date, count: number): WeekRow[] {
  const monday = getMondayOf(from);
  return Array.from({ length: count }, (_, w) => {
    const weekStart = new Date(monday);
    weekStart.setDate(monday.getDate() + w * 7);
    const days = Array.from({ length: 7 }, (_, d) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + d);
      return day;
    });
    return { weekNumber: getISOWeek(weekStart), year: weekStart.getFullYear(), days };
  });
}

interface DayInfo {
  status: DayStatus;
  booking: Booking | null;
  isArrival: boolean;
  isDeparture: boolean;
  isCheckoutOnly: boolean; // utcheckningsdag — halvdag, ny bokning tillåten
  checkoutBooking: Booking | null; // bokningens checkout (kan skilja sig från booking vid dubbel-dag)
}

function getDayStatus(date: Date, bookings: Booking[]): DayInfo {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isPast = date < today;
  const isToday = date.getTime() === today.getTime();
  const dk = dateKey(date);

  // Hitta bokning som är aktiv denna dag (ej utcheckningsdagen)
  let activeBooking: Booking | null = null;
  let checkoutBooking: Booking | null = null;

  for (const b of bookings) {
    const start = parseLocalDate(b.startDate);
    const end = parseLocalDate(b.endDate);
    if (date >= start && date < end) activeBooking = b;
    if (dk === dateKey(end)) checkoutBooking = b;
  }

  if (activeBooking) {
    const start = parseLocalDate(activeBooking.startDate);
    const status = activeBooking.source === "AIRBNB" ? "booked_airbnb" : "booked_internal";
    return {
      status,
      booking: activeBooking,
      isArrival: dk === dateKey(start),
      isDeparture: false,
      isCheckoutOnly: false,
      checkoutBooking,
    };
  }

  if (checkoutBooking) {
    const status = checkoutBooking.source === "AIRBNB" ? "booked_airbnb" : "booked_internal";
    return {
      status,
      booking: null,
      isArrival: false,
      isDeparture: true,
      isCheckoutOnly: true,
      checkoutBooking,
    };
  }

  if (isPast) return { status: "past", booking: null, isArrival: false, isDeparture: false, isCheckoutOnly: false, checkoutBooking: null };
  // isToday används inte längre — idag visas som en vanlig tillgänglig dag
  return { status: "available", booking: null, isArrival: false, isDeparture: false, isCheckoutOnly: false, checkoutBooking: null };
}

function dayCssClass(status: DayStatus, inRange: boolean, isStart: boolean): string {
  if (inRange || isStart) return "day-selected";
  switch (status) {
    case "past":             return "day-past";
    case "today":            return "day-today";
    case "booked_internal":  return "day-booked-internal";
    case "booked_airbnb":    return "day-booked-airbnb";
    default:                 return "day-available";
  }
}

function dayTextColor(status: DayStatus, inRange: boolean, isStart: boolean): string {
  if (inRange || isStart)           return "#c7d2fe";
  if (status === "past")            return "#4b5563";
  if (status === "today")           return "#4ade80";
  if (status === "booked_internal") return "#bfdbfe";
  if (status === "booked_airbnb")   return "#fed7aa";
  return "#9ca3af";
}

export function WeekCalendar({ propertyId }: { propertyId: string }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeksAhead, setWeeksAhead] = useState(16);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);

  const [selectStart, setSelectStart] = useState<Date | null>(null);
  const [hoverDay, setHoverDay] = useState<Date | null>(null);
  const [pendingRange, setPendingRange] = useState<{ start: Date; end: Date } | null>(null);
  const [viewBooking, setViewBooking] = useState<Booking | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const today = new Date();
    const monday = getMondayOf(today);
    const endDate = addDays(monday, weeksAhead * 7);
    const res = await fetch(
      `/api/bookings?propertyId=${propertyId}&from=${dateKey(monday)}&to=${dateKey(endDate)}`
    );
    if (res.ok) setBookings(await res.json());
    setWeeks(generateWeeks(today, weeksAhead));
    setLoading(false);
  }, [propertyId, weeksAhead]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  function handleDayClick(day: Date, status: DayStatus, booking: Booking | null, isCheckoutOnly?: boolean, checkoutBooking?: Booking | null) {
    if (status === "past") return;

    if ((status === "booked_internal" || status === "booked_airbnb") && !isCheckoutOnly) {
      setViewBooking(booking);
      return;
    }

    // Utcheckningsdag — tillåt incheckning samma dag
    if (isCheckoutOnly) {
      if (!selectStart) {
        setSelectStart(day);
      } else {
        const [start, end] = day >= selectStart ? [selectStart, day] : [day, selectStart];
        const hasConflict = bookings.some((b) => {
          const bs = parseLocalDate(b.startDate);
          const be = parseLocalDate(b.endDate);
          return bs < addDays(end, 1) && be > start;
        });
        if (hasConflict) {
          alert("Det finns bokade dagar i det valda intervallet. Välj ett annat datum.");
          setSelectStart(null); setHoverDay(null); return;
        }
        setPendingRange({ start, end });
        setSelectStart(null); setHoverDay(null);
      }
      return;
    }

    if (!selectStart) {
      setSelectStart(day);
      return;
    }

    const [start, end] = day >= selectStart ? [selectStart, day] : [day, selectStart];
    const hasConflict = bookings.some((b) => {
      const bs = parseLocalDate(b.startDate);
      const be = parseLocalDate(b.endDate);
      return bs < addDays(end, 1) && be > start;
    });
    if (hasConflict) {
      alert("Det finns bokade dagar i det valda intervallet. Välj ett annat datum.");
      setSelectStart(null);
      setHoverDay(null);
      return;
    }
    setPendingRange({ start, end });
    setSelectStart(null);
    setHoverDay(null);
  }

  function isInRange(day: Date): boolean {
    if (!selectStart) return false;
    const endPt = hoverDay ?? selectStart;
    const [a, b] = selectStart <= endPt ? [selectStart, endPt] : [endPt, selectStart];
    return day > a && day <= b;
  }

  // Detect month changes between weeks for section headers
  let lastRenderedMonth = -1;

  return (
    <div>
      {/* Legend + controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <LegendDot cls="day-available" label="Ledig" textColor="#6b7280" />
          <LegendDot cls="day-booked-internal" label="Bokad (internt)" textColor="#93c5fd" />
          <LegendDot cls="day-booked-airbnb" label="Bokad (Airbnb)" textColor="#fdba74" />
          <LegendDot cls="day-selected" label="Markerat" textColor="#a5b4fc" />
        </div>
        <div className="flex items-center gap-3">
          {selectStart && (
            <span className="text-xs font-medium text-indigo-400 animate-pulse">
              Klicka på slutdatum…
            </span>
          )}
          <select
            value={weeksAhead}
            onChange={(e) => setWeeksAhead(Number(e.target.value))}
            className="rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <option value={8}>8 veckor</option>
            <option value={16}>16 veckor</option>
            <option value={26}>26 veckor</option>
            <option value={52}>52 veckor</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-600">Laddar kalender…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          <table className="border-collapse w-full" style={{ minWidth: 640 }}>
            {/* Day-name header */}
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <th
                  className="py-4 pl-4 pr-3 text-left text-xs font-semibold text-gray-600 select-none"
                  style={{ width: 56 }}
                >
                  V.
                </th>
                {DAY_NAMES.map((d, i) => (
                  <th
                    key={d}
                    className="py-4 px-1 text-center text-xs font-bold tracking-wide select-none"
                    style={{
                      color: i >= 5 ? "#818cf8" : "#9ca3af",
                      minWidth: 84,
                      background: i >= 5 ? "rgba(99,102,241,0.06)" : "transparent",
                      borderLeft: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wi) => {
                // Month header row when month changes
                const firstDay = week.days[0];
                const showMonthHeader = firstDay.getMonth() !== lastRenderedMonth;
                if (showMonthHeader) lastRenderedMonth = firstDay.getMonth();

                return (
                  <>
                    {showMonthHeader && (
                      <tr key={`month-${wi}`}>
                        <td
                          colSpan={8}
                          className="pt-5 pb-2 pl-4 text-xs font-bold tracking-widest uppercase"
                          style={{
                            color: "rgba(255,255,255,0.35)",
                            borderTop: wi > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                          }}
                        >
                          {MONTHS_SV[firstDay.getMonth()]} {firstDay.getFullYear()}
                        </td>
                      </tr>
                    )}
                    <tr
                      key={`${week.year}-${week.weekNumber}`}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <td className="py-1.5 pl-4 pr-3 text-xs font-bold text-gray-700 align-middle select-none whitespace-nowrap">
                        {week.weekNumber}
                      </td>
                      {week.days.map((day) => {
                        const { status, booking, isArrival, isDeparture, isCheckoutOnly, checkoutBooking } = getDayStatus(day, bookings);
                        const inRange = isInRange(day);
                        const isStart = selectStart != null && dateKey(day) === dateKey(selectStart);
                        const cssClass = dayCssClass(status, inRange, isStart);
                        const textColor = dayTextColor(status, inRange, isStart);
                        const isWeekend = day.getDay() === 6 || day.getDay() === 0;
                        const isClickable = status !== "past";
                        const isBooked = status === "booked_internal" || status === "booked_airbnb";
                        const arrivalColor = status === "booked_airbnb" ? "#f97316" : "#3b82f6";
                        const coColor = checkoutBooking?.source === "AIRBNB" ? "#f97316" : "#3b82f6";
                        // Visa split när det är en UT-dag (ensam eller tillsammans med ny incheckning)
                        const showSplit = isCheckoutOnly || (isArrival && checkoutBooking !== null);

                        return (
                          <td
                            key={dateKey(day)}
                            className="p-1 align-top"
                            style={{
                              borderLeft: "1px solid rgba(255,255,255,0.05)",
                              background: isWeekend ? "rgba(99,102,241,0.03)" : "transparent",
                            }}
                          >
                            {showSplit ? (
                              /* ── Delad cell: UT vänster / IN höger ── */
                              <div
                                className="rounded-lg overflow-hidden relative"
                                style={{ minHeight: 76, cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)" }}
                                onClick={() => isClickable && handleDayClick(day, status, booking, isCheckoutOnly, checkoutBooking)}
                                onMouseEnter={() => selectStart && setHoverDay(day)}
                                onMouseLeave={() => selectStart && setHoverDay(null)}
                              >
                                {/* Vänster halva — utcheckning */}
                                <div
                                  className="absolute inset-y-0 left-0"
                                  style={{
                                    width: "50%",
                                    background: "rgba(220,38,38,0.35)",
                                    borderRight: "1px solid rgba(255,255,255,0.15)",
                                  }}
                                >
                                  <span
                                    className="absolute top-1 left-1 rounded text-[8px] font-bold px-1 py-0.5 leading-none"
                                    style={{ background: "#dc2626", color: "#fff" }}
                                  >UT</span>
                                </div>
                                {/* Höger halva — incheckning eller ledig */}
                                <div
                                  className="absolute inset-y-0 right-0"
                                  style={{
                                    width: "50%",
                                    background: isArrival
                                      ? (arrivalColor === "#f97316" ? "rgba(249,115,22,0.28)" : "rgba(59,130,246,0.28)")
                                      : "rgba(34,197,94,0.07)",
                                  }}
                                >
                                  {isArrival && (
                                    <span
                                      className="absolute top-1 right-1 rounded text-[8px] font-bold px-1 py-0.5 leading-none"
                                      style={{ background: arrivalColor, color: "#fff" }}
                                    >IN</span>
                                  )}
                                </div>
                                {/* Datum — vänster halva */}
                                <div className="absolute top-0 left-0 z-10 p-2" style={{ width: "50%" }}>
                                  <span className="text-sm font-bold leading-none" style={{ color: "#f87171" }}>
                                    {day.getDate()}
                                  </span>
                                </div>
                                {/* Gästinfo — höger halva */}
                                {isArrival && booking && (
                                  <div className="absolute top-0 right-0 z-10 p-2 space-y-0.5" style={{ width: "50%" }}>
                                    {(booking.guestName || booking.userName) && (
                                      <div className="text-[10px] font-semibold leading-tight truncate" style={{ color: "#bfdbfe" }}>
                                        {booking.guestName || booking.userName}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1 text-[9px]" style={{ color: "#bfdbfe", opacity: 0.75 }}>
                                      {booking.numberOfPersons && <span>👤{booking.numberOfPersons}</span>}
                                      {(booking.numberOfBoats ?? 0) > 0 && <span>🚤{booking.numberOfBoats}</span>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* ── Vanlig cell ── */
                              <div
                                className={`${cssClass} rounded-lg transition-all relative overflow-hidden`}
                                style={{
                                  cursor: isClickable ? "pointer" : "default",
                                  minHeight: 76,
                                  padding: "8px 7px",
                                  opacity: status === "past" ? 0.35 : 1,
                                  borderLeft: isArrival ? `3px solid ${arrivalColor}` : undefined,
                                }}
                                onClick={() => isClickable && handleDayClick(day, status, booking, isCheckoutOnly, checkoutBooking)}
                                onMouseEnter={() => selectStart && isClickable && setHoverDay(day)}
                                onMouseLeave={() => selectStart && setHoverDay(null)}
                              >
                                {isArrival && (
                                  <span className="absolute top-1 right-1 rounded text-[8px] font-bold px-1 py-0.5 leading-none"
                                    style={{ background: arrivalColor, color: "#fff", opacity: 0.9 }}>IN</span>
                                )}
                                {isDeparture && (
                                  <span className="absolute bottom-1 right-1 rounded text-[8px] font-bold px-1 py-0.5 leading-none"
                                    style={{ background: "#dc2626", color: "#fff", opacity: 0.9 }}>UT</span>
                                )}
                                <div className="flex items-start justify-between">
                                  <span className="text-sm font-bold leading-none" style={{ color: textColor }}>{day.getDate()}</span>
                                  {isWeekend && !isArrival && !isDeparture && (
                                    <span className="text-[9px] font-semibold leading-none" style={{ color: "rgba(129,140,248,0.6)" }}>
                                      {day.getDay() === 6 ? "Lör" : "Sön"}
                                    </span>
                                  )}
                                </div>
                                {day.getDate() === 1 && (
                                  <div className="text-[10px] mt-0.5 font-medium" style={{ color: textColor, opacity: 0.6 }}>
                                    {MONTHS_SHORT[day.getMonth()]}
                                  </div>
                                )}
                                {isBooked && booking && isArrival && (
                                  <div className="mt-2 space-y-0.5">
                                    {(booking.guestName || booking.userName) && (
                                      <div className="text-[11px] font-semibold leading-tight truncate" style={{ color: textColor, maxWidth: 72 }}>
                                        {booking.guestName || booking.userName}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1 text-[10px]" style={{ color: textColor, opacity: 0.75 }}>
                                      {booking.numberOfPersons && <span>👤{booking.numberOfPersons}</span>}
                                      {(booking.numberOfBoats ?? 0) > 0 && <span>🚤{booking.numberOfBoats}</span>}
                                    </div>
                                    {status === "booked_airbnb" && (
                                      <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: textColor, opacity: 0.6 }}>Airbnb</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
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

      {/* Floating selection hint */}
      {selectStart && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-2xl px-6 py-3 text-sm text-white shadow-2xl"
          style={{
            background: "linear-gradient(135deg, rgba(79,70,229,0.95), rgba(109,40,217,0.95))",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(165,180,252,0.2)",
          }}
        >
          <span>
            Start:{" "}
            <strong>{selectStart.toLocaleDateString("sv-SE", { day: "numeric", month: "long" })}</strong>
            {" — "}klicka på slutdatum
          </span>
          <button
            onClick={() => { setSelectStart(null); setHoverDay(null); }}
            className="ml-1 rounded-full h-5 w-5 flex items-center justify-center text-indigo-200 hover:text-white hover:bg-white/10 transition"
          >
            ✕
          </button>
        </div>
      )}

      {pendingRange && (
        <BookingFormModal
          start={pendingRange.start}
          end={pendingRange.end}
          propertyId={propertyId}
          onClose={() => setPendingRange(null)}
          onBooked={() => { setPendingRange(null); fetchBookings(); }}
        />
      )}

      {viewBooking && (
        <BookingDetailModal
          booking={viewBooking}
          onClose={() => setViewBooking(null)}
          onDeleted={() => { setViewBooking(null); fetchBookings(); }}
        />
      )}
    </div>
  );
}

// ─── Booking form modal ───────────────────────────────────────────────────────

function BookingFormModal({ start, end, propertyId, onClose, onBooked }: {
  start: Date; end: Date; propertyId: string;
  onClose: () => void; onBooked: () => void;
}) {
  // startStr = incheckning, endStr = utcheckning (exclusive, dag efter sista natten)
  const [startStr, setStartStr] = useState(dateKey(start));
  const [endStr, setEndStr] = useState(dateKey(end));
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [persons, setPersons] = useState(1);
  const [boatCounts, setBoatCounts] = useState<Record<BoatId, number>>({
    boat6hp: 0, boat99hp: 0, boat20hp: 0, boat25hp: 0,
  });
  const [notes, setNotes] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const [bedLinen, setBedLinen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nights = Math.max(0, Math.round(
    (new Date(endStr).getTime() - new Date(startStr).getTime()) / 86400000
  ));

  function setBoat(id: BoatId, val: number) {
    setBoatCounts(prev => ({ ...prev, [id]: Math.max(0, val) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId, startDate: startStr,
        endDate: endStr,
        guestName: guestName || undefined,
        guestEmail: guestEmail || undefined,
        notes: notes || undefined,
        numberOfPersons: persons,
        ...boatCounts,
        cleaning,
        bedLinen,
      }),
    });
    setLoading(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Kunde inte skapa bokningen"); return; }
    onBooked();
  }

  const boatTotal = BOAT_TYPES.reduce((s, t) => s + boatPrice(t.weekPrice, nights) * boatCounts[t.id as BoatId], 0);

  return (
    <Modal onClose={onClose}>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Ny bokning</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {nights} {nights !== 1 ? "nätter" : "natt"}
          </p>
        </div>
        <CloseBtn onClick={onClose} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Incheckning</label>
            <input type="date" required value={startStr}
              onChange={(e) => setStartStr(e.target.value)} className="input-dark w-full" />
          </div>
          <div>
            <label className="field-label">Utcheckning</label>
            <input type="date" required value={endStr} min={addDays(new Date(startStr), 1).toISOString().slice(0,10)}
              onChange={(e) => setEndStr(e.target.value)} className="input-dark w-full" />
          </div>
        </div>

        {/* Guest name + email */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Fiskegrupp / gästnamn <Opt /></label>
            <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
              className="input-dark w-full" placeholder="Kowalski fiskesällskap" />
          </div>
          <div>
            <label className="field-label">Gästens e-post <Opt /></label>
            <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)}
              className="input-dark w-full" placeholder="gast@exempel.se" />
          </div>
        </div>

        {/* Persons */}
        <div>
          <label className="field-label">Antal personer</label>
          <Stepper value={persons} min={1} max={100} onChange={setPersons} />
        </div>

        {/* Boats per type */}
        <div>
          <label className="field-label mb-2 block">Båtar <Opt /></label>
          <div className="space-y-2">
            {BOAT_TYPES.map(t => {
              const id = t.id as BoatId;
              const price = boatPrice(t.weekPrice, nights);
              const max = t.total;
              const count = boatCounts[id];
              return (
                <div key={id}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: count > 0 ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.04)", border: count > 0 ? "1px solid rgba(37,99,235,0.4)" : "1px solid rgba(255,255,255,0.08)" }}
                >
                  <span className="text-sm font-semibold text-white flex-1">🚤 Motor {t.label}</span>
                  <span className="text-xs text-blue-400">{price.toLocaleString("sv-SE")} kr</span>
                  <div className="flex items-center gap-1.5">
                    <button type="button"
                      onClick={() => setBoat(id, count - 1)}
                      disabled={count === 0}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-base font-bold text-gray-300 hover:text-white disabled:opacity-30 transition"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>−</button>
                    <span className="w-6 text-center text-sm font-bold text-white">{count}</span>
                    <button type="button"
                      onClick={() => setBoat(id, count + 1)}
                      disabled={count >= max}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-base font-bold text-gray-300 hover:text-white disabled:opacity-30 transition"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
          {boatTotal > 0 && (
            <p className="mt-2 text-right text-sm text-blue-400">
              Båtar totalt: <strong className="text-white">{boatTotal.toLocaleString("sv-SE")} kr</strong>
            </p>
          )}
        </div>

        {/* Städning + Lakan */}
        <div className="flex gap-4">
          <CheckOption
            id="cleaning" checked={cleaning} onChange={setCleaning}
            label="Städning" emoji="🧹"
          />
          <CheckOption
            id="bedlinen" checked={bedLinen} onChange={setBedLinen}
            label="Lakan" emoji="🛏"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="field-label">Anteckning <Opt /></label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            className="input-dark w-full resize-none" rows={2}
            placeholder="Ankomstid, önskemål…" />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <GhostBtn onClick={onClose}>Avbryt</GhostBtn>
          <PrimaryBtn type="submit" disabled={loading}>
            {loading ? "Bokar…" : "Bekräfta bokning"}
          </PrimaryBtn>
        </div>
      </form>
    </Modal>
  );
}

// ─── Booking detail modal ─────────────────────────────────────────────────────

function BookingDetailModal({ booking, onClose, onDeleted }: {
  booking: Booking; onClose: () => void; onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleDelete() {
    if (!confirm("Ta bort bokningen?")) return;
    setLoading(true);
    const res = await fetch(`/api/bookings/${booking.id}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) onDeleted();
    else { const d = await res.json(); alert(d.error || "Kunde inte ta bort"); }
  }

  async function handleSendEmail() {
    if (!emailInput.includes("@")) { alert("Ange en giltig e-postadress"); return; }
    setSending(true);
    const res = await fetch(`/api/bookings/${booking.id}/send-guest-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailInput }),
    });
    setSending(false);
    if (res.ok) { setSent(true); setEmailInput(""); }
    else { const d = await res.json(); alert(d.error || "Kunde inte skicka mailet"); }
  }

  const start = new Date(booking.startDate);
  const end = new Date(booking.endDate);
  const lastDay = addDays(end, -1);
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);
  const fmt = (d: Date) => d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Modal onClose={onClose}>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-white">
            {booking.guestName || booking.userName || "Bokning"}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: booking.source === "AIRBNB" ? "#fdba74" : "#93c5fd" }}>
            {booking.source === "AIRBNB" ? "Airbnb" : "Internbokning"}
          </p>
        </div>
        <CloseBtn onClick={onClose} />
      </div>

      <div className="space-y-3">
        <DetailRow label="Incheckning" value={fmt(start)} />
        <DetailRow label="Utcheckning" value={fmt(lastDay)} />
        <DetailRow label="Nätter" value={`${nights} ${nights !== 1 ? "nätter" : "natt"}`} />
        {booking.numberOfPersons != null && (
          <DetailRow label="Antal personer" value={`${booking.numberOfPersons} person${booking.numberOfPersons !== 1 ? "er" : ""}`} />
        )}
        {(booking.numberOfBoats ?? 0) > 0 && (
          <DetailRow label="Båtar" value={
            BOAT_TYPES.filter(t => ((booking as unknown as Record<string, number>)[t.id] ?? 0) > 0)
              .map(t => `${(booking as unknown as Record<string, number>)[t.id]}× ${t.label}`)
              .join(", ")
          } />
        )}
        {(booking.cleaning || booking.bedLinen) && (
          <DetailRow
            label="Övrigt"
            value={[booking.cleaning && "Städning", booking.bedLinen && "Lakan"].filter(Boolean).join(", ")}
          />
        )}
        {booking.notes && <DetailRow label="Anteckning" value={booking.notes} />}
        {booking.userName && booking.source !== "AIRBNB" && (
          <DetailRow label="Bokad av" value={booking.userName} />
        )}
      </div>

      {/* Skicka bokningsmail till gäst */}
      <div className="mt-5 rounded-xl p-4" style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}>
        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#60a5fa" }}>
          ✉️ Skicka bokningsmail till gäst
        </p>
        <p className="text-xs mb-3" style={{ color: "#6b7280" }}>
          Gästen får bekräftelse med knappar för att boka båt, städning och lakan.
        </p>
        {sent ? (
          <p className="text-sm font-semibold" style={{ color: "#4ade80" }}>✓ Mail skickat!</p>
        ) : (
          <div className="flex gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="gast@exempel.se"
              className="input-dark flex-1 text-sm"
              onKeyDown={e => e.key === "Enter" && handleSendEmail()}
            />
            <button
              onClick={handleSendEmail}
              disabled={sending || !emailInput}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 transition whitespace-nowrap"
              style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}
            >
              {sending ? "Skickar…" : "Skicka"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        {booking.source !== "AIRBNB" ? (
          <button onClick={handleDelete} disabled={loading}
            className="text-sm text-red-500 hover:text-red-400 transition disabled:opacity-60">
            {loading ? "Tar bort…" : "Ta bort bokning"}
          </button>
        ) : <span />}
        <GhostBtn onClick={onClose}>Stäng</GhostBtn>
      </div>
    </Modal>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl"
        style={{ background: "#0e1320", border: "1px solid rgba(255,255,255,0.1)" }}>
        {children}
      </div>
    </div>
  );
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="text-gray-600 hover:text-gray-300 text-xl leading-none transition mt-0.5">✕</button>
  );
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition"
      style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
      {children}
    </button>
  );
}

function PrimaryBtn({ children, type = "button", disabled, onClick }: {
  children: React.ReactNode; type?: "button" | "submit";
  disabled?: boolean; onClick?: () => void;
}) {
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
      style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}>
      {children}
    </button>
  );
}

function Stepper({ value, min, max, onChange }: {
  value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
        className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-lg text-lg font-bold text-gray-300 hover:text-white transition"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
        −
      </button>
      <input type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input-dark text-center flex-1 font-semibold text-white text-base" />
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
        className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-lg text-lg font-bold text-gray-300 hover:text-white transition"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
        +
      </button>
    </div>
  );
}

function Opt() {
  return <span className="text-gray-600 font-normal">(valfritt)</span>;
}

function CheckOption({ id, checked, onChange, label, emoji }: {
  id: string; checked: boolean; onChange: (v: boolean) => void; label: string; emoji: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl px-4 py-3 transition-all select-none"
      style={{
        background: checked ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
        border: checked ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <input
        id={id} type="checkbox" checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="hidden"
      />
      <span className="text-xl leading-none">{emoji}</span>
      <span className="text-sm font-medium" style={{ color: checked ? "#a5b4fc" : "#6b7280" }}>
        {label}
      </span>
      <span
        className="ml-auto h-4 w-4 rounded flex items-center justify-center text-[10px] font-bold"
        style={{
          background: checked ? "#6366f1" : "rgba(255,255,255,0.06)",
          border: checked ? "none" : "1px solid rgba(255,255,255,0.1)",
          color: "#fff",
        }}
      >
        {checked ? "✓" : ""}
      </span>
    </label>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-white text-right">{value}</span>
    </div>
  );
}

function LegendDot({ cls, label, textColor }: { cls: string; label: string; textColor: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`${cls} h-3 w-3 rounded`} style={{ display: "inline-block" }} />
      <span style={{ color: textColor }}>{label}</span>
    </span>
  );
}
