"use client";

import { useEffect, useState, useCallback } from "react";
import { getISOWeek } from "date-fns";

export interface Booking {
  id: string;
  startDate: string;
  endDate: string;
  guestName: string | null;
  userName: string | null;
  notes: string | null;
  numberOfPersons: number | null;
  numberOfBoats: number | null;
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
  return d.toISOString().slice(0, 10);
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

function getDayStatus(date: Date, bookings: Booking[]): { status: DayStatus; booking: Booking | null } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (date.getTime() === today.getTime()) {
    for (const b of bookings) {
      const start = new Date(b.startDate);
      const end = new Date(b.endDate);
      if (date >= start && date < end)
        return { status: b.source === "AIRBNB" ? "booked_airbnb" : "booked_internal", booking: b };
    }
    return { status: "today", booking: null };
  }
  if (date < today) return { status: "past", booking: null };
  for (const b of bookings) {
    const start = new Date(b.startDate);
    const end = new Date(b.endDate);
    if (date >= start && date < end)
      return { status: b.source === "AIRBNB" ? "booked_airbnb" : "booked_internal", booking: b };
  }
  return { status: "available", booking: null };
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
  if (inRange || isStart)         return "#a5b4fc";
  if (status === "past")          return "#374151";
  if (status === "today")         return "#4ade80";
  if (status === "booked_internal") return "#93c5fd";
  if (status === "booked_airbnb")   return "#fdba74";
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

  function handleDayClick(day: Date, status: DayStatus, booking: Booking | null) {
    if (status === "past") return;

    if (status === "booked_internal" || status === "booked_airbnb") {
      setViewBooking(booking);
      return;
    }

    if (!selectStart) {
      setSelectStart(day);
      return;
    }

    const [start, end] = day >= selectStart ? [selectStart, day] : [day, selectStart];
    const hasConflict = bookings.some((b) => {
      const bs = new Date(b.startDate);
      const be = new Date(b.endDate);
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
          <LegendDot cls="day-today" label="Idag" textColor="#4ade80" />
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
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <table className="border-collapse w-full" style={{ minWidth: 640 }}>
            {/* Day-name header */}
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <th
                  className="py-3 pl-4 pr-2 text-left text-xs font-medium text-gray-600 select-none"
                  style={{ width: 56 }}
                >
                  V.
                </th>
                {DAY_NAMES.map((d, i) => (
                  <th
                    key={d}
                    className="py-3 px-1 text-center text-xs font-medium select-none"
                    style={{
                      color: i >= 5 ? "rgba(99,102,241,0.7)" : "#6b7280",
                      minWidth: 80,
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
                          className="pt-4 pb-1 pl-4 text-xs font-semibold tracking-wider uppercase"
                          style={{ color: "rgba(255,255,255,0.25)" }}
                        >
                          {MONTHS_SV[firstDay.getMonth()]} {firstDay.getFullYear()}
                        </td>
                      </tr>
                    )}
                    <tr key={`${week.year}-${week.weekNumber}`}>
                      <td className="py-1 pl-4 pr-2 text-xs font-medium text-gray-700 align-middle select-none">
                        {week.weekNumber}
                      </td>
                      {week.days.map((day) => {
                        const { status, booking } = getDayStatus(day, bookings);
                        const inRange = isInRange(day);
                        const isStart = selectStart != null && dateKey(day) === dateKey(selectStart);
                        const cssClass = dayCssClass(status, inRange, isStart);
                        const textColor = dayTextColor(status, inRange, isStart);
                        const isWeekend = day.getDay() === 6 || day.getDay() === 0;
                        const isClickable = status !== "past";

                        return (
                          <td key={dateKey(day)} className="p-1 align-top">
                            <div
                              className={`${cssClass} rounded-lg transition-all`}
                              style={{
                                cursor: isClickable ? "pointer" : "default",
                                minHeight: 72,
                                padding: "8px 6px",
                                opacity: status === "past" ? 0.4 : 1,
                              }}
                              onClick={() => isClickable && handleDayClick(day, status, booking)}
                              onMouseEnter={() => selectStart && isClickable && setHoverDay(day)}
                              onMouseLeave={() => selectStart && setHoverDay(null)}
                            >
                              {/* Date number */}
                              <div className="flex items-start justify-between">
                                <span
                                  className="text-sm font-bold leading-none"
                                  style={{ color: textColor }}
                                >
                                  {day.getDate()}
                                </span>
                                {isWeekend && status === "available" && (
                                  <span className="text-[9px] leading-none" style={{ color: "rgba(99,102,241,0.5)" }}>
                                    {day.getDay() === 6 ? "Lör" : "Sön"}
                                  </span>
                                )}
                              </div>

                              {/* Month label on 1st of month */}
                              {day.getDate() === 1 && (
                                <div className="text-[10px] mt-0.5 font-medium" style={{ color: textColor, opacity: 0.6 }}>
                                  {MONTHS_SHORT[day.getMonth()]}
                                </div>
                              )}

                              {/* Booking info */}
                              {(status === "booked_internal") && booking && (
                                <div className="mt-2 space-y-0.5">
                                  {(booking.guestName || booking.userName) && (
                                    <div
                                      className="text-[11px] font-medium leading-tight truncate"
                                      style={{ color: textColor, maxWidth: 72 }}
                                    >
                                      {booking.guestName || booking.userName}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1 text-[10px]" style={{ color: textColor, opacity: 0.7 }}>
                                    {booking.numberOfPersons && (
                                      <span>👤 {booking.numberOfPersons}</span>
                                    )}
                                    {booking.numberOfBoats != null && booking.numberOfBoats > 0 && (
                                      <span>🚤 {booking.numberOfBoats}</span>
                                    )}
                                  </div>
                                </div>
                              )}
                              {status === "booked_airbnb" && (
                                <div className="mt-2 text-[10px] font-medium" style={{ color: textColor, opacity: 0.8 }}>
                                  Airbnb
                                </div>
                              )}
                            </div>
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
  const [startStr, setStartStr] = useState(dateKey(start));
  const [endStr, setEndStr] = useState(dateKey(end));
  const [guestName, setGuestName] = useState("");
  const [persons, setPersons] = useState(1);
  const [boats, setBoats] = useState(1);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nights = Math.max(0, Math.round(
    (new Date(endStr).getTime() - new Date(startStr).getTime()) / 86400000
  )) + 1;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const endExclusive = addDays(new Date(endStr), 1);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId, startDate: startStr,
        endDate: dateKey(endExclusive),
        guestName: guestName || undefined,
        notes: notes || undefined,
        numberOfPersons: persons,
        numberOfBoats: boats,
      }),
    });
    setLoading(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Kunde inte skapa bokningen"); return; }
    onBooked();
  }

  return (
    <Modal onClose={onClose}>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Ny bokning</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {nights} natt{nights !== 1 ? "er" : ""}
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
            <label className="field-label">Sista natten</label>
            <input type="date" required value={endStr} min={startStr}
              onChange={(e) => setEndStr(e.target.value)} className="input-dark w-full" />
          </div>
        </div>

        {/* Guest name */}
        <div>
          <label className="field-label">Fiskegrupp / gästnamn <Opt /></label>
          <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
            className="input-dark w-full" placeholder="Kowalski fiskesällskap" />
        </div>

        {/* Persons + Boats */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Antal personer</label>
            <Stepper value={persons} min={1} max={100} onChange={setPersons} />
          </div>
          <div>
            <label className="field-label">Antal båtar att hyra</label>
            <Stepper value={boats} min={0} max={20} onChange={setBoats} />
          </div>
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

  async function handleDelete() {
    if (!confirm("Ta bort bokningen?")) return;
    setLoading(true);
    const res = await fetch(`/api/bookings/${booking.id}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) onDeleted();
    else { const d = await res.json(); alert(d.error || "Kunde inte ta bort"); }
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
        <DetailRow label="Nätter" value={`${nights} natt${nights !== 1 ? "er" : ""}`} />
        {booking.numberOfPersons != null && (
          <DetailRow label="Antal personer" value={`${booking.numberOfPersons} person${booking.numberOfPersons !== 1 ? "er" : ""}`} />
        )}
        {booking.numberOfBoats != null && (
          <DetailRow label="Båtar" value={`${booking.numberOfBoats} båt${booking.numberOfBoats !== 1 ? "ar" : ""}`} />
        )}
        {booking.notes && <DetailRow label="Anteckning" value={booking.notes} />}
        {booking.userName && booking.source !== "AIRBNB" && (
          <DetailRow label="Bokad av" value={booking.userName} />
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
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
