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

type DayStatus = "available" | "booked_internal" | "booked_airbnb" | "past";

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

function getDayInfo(date: Date, bookings: Booking[]): { status: DayStatus; booking: Booking | null } {
  const today = new Date(); today.setHours(0,0,0,0);
  if (date < today) return { status: "past", booking: null };
  for (const b of bookings) {
    const start = new Date(b.startDate);
    const end = new Date(b.endDate);
    if (date >= start && date < end) {
      return { status: b.source === "AIRBNB" ? "booked_airbnb" : "booked_internal", booking: b };
    }
  }
  return { status: "available", booking: null };
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
    const endDate = new Date(monday);
    endDate.setDate(endDate.getDate() + weeksAhead * 7);

    const res = await fetch(
      `/api/bookings?propertyId=${propertyId}&from=${dateKey(monday)}&to=${dateKey(endDate)}`
    );
    if (res.ok) setBookings(await res.json());
    setWeeks(generateWeeks(today, weeksAhead));
    setLoading(false);
  }, [propertyId, weeksAhead]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  function handleDayClick(day: Date) {
    const { status, booking } = getDayInfo(day, bookings);

    if (status === "past") return;

    if (status !== "available") {
      setViewBooking(booking);
      return;
    }

    if (!selectStart) {
      setSelectStart(day);
      return;
    }

    // Complete selection
    const [start, end] = day >= selectStart ? [selectStart, day] : [day, selectStart];
    // Check no booked days in range
    const hasConflict = bookings.some((b) => {
      const bs = new Date(b.startDate);
      const be = new Date(b.endDate);
      return bs < addDays(end, 1) && be > start;
    });
    if (hasConflict) {
      alert("Det finns bokade dagar i det valda intervallet.");
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
    return day >= a && day <= b;
  }

  function cellStyle(day: Date) {
    const { status } = getDayInfo(day, bookings);
    const inRange = isInRange(day);
    const isStart = selectStart && dateKey(day) === dateKey(selectStart);
    const today = new Date(); today.setHours(0,0,0,0);
    const isToday = dateKey(day) === dateKey(today);

    if (inRange || isStart) return { bg: "rgba(99,102,241,0.3)", border: "rgba(99,102,241,0.6)", text: "#c7d2fe", cursor: "pointer" };
    if (status === "past")            return { bg: "rgba(255,255,255,0.02)", border: "rgba(255,255,255,0.04)", text: "#374151", cursor: "default" };
    if (status === "booked_internal") return { bg: "rgba(59,130,246,0.18)", border: "rgba(59,130,246,0.4)", text: "#93c5fd", cursor: "pointer" };
    if (status === "booked_airbnb")   return { bg: "rgba(249,115,22,0.18)", border: "rgba(249,115,22,0.4)", text: "#fdba74", cursor: "pointer" };
    if (isToday)                       return { bg: "rgba(34,197,94,0.18)", border: "rgba(34,197,94,0.5)", text: "#4ade80", cursor: "pointer" };
    return { bg: "rgba(34,197,94,0.05)", border: "rgba(34,197,94,0.12)", text: "#6b7280", cursor: "pointer" };
  }

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <Dot color="rgba(34,197,94,0.5)" label="Ledig" />
          <Dot color="rgba(59,130,246,0.6)" label="Bokad (internt)" />
          <Dot color="rgba(249,115,22,0.6)" label="Bokad (Airbnb)" />
          <Dot color="rgba(99,102,241,0.6)" label="Markerat" />
        </div>
        <div className="flex items-center gap-2">
          {selectStart && (
            <span className="text-xs text-indigo-400 animate-pulse">
              Klicka på slutdatum…
            </span>
          )}
          <select
            value={weeksAhead}
            onChange={(e) => setWeeksAhead(Number(e.target.value))}
            className="rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
            style={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <option value={8}>8 veckor</option>
            <option value={16}>16 veckor</option>
            <option value={26}>26 veckor</option>
            <option value={52}>52 veckor</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-600">Laddar kalender…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-collapse" style={{ minWidth: 580 }}>
            <thead>
              <tr>
                <th className="pb-2 pr-2 text-left text-xs text-gray-600 font-normal w-12">V.</th>
                {DAY_NAMES.map((d) => (
                  <th key={d} className="pb-2 px-0.5 text-center text-xs text-gray-600 font-normal" style={{ minWidth: 72 }}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={`${week.year}-${week.weekNumber}`}>
                  <td className="pr-2 text-xs text-gray-700 align-top pt-2 select-none">
                    {week.weekNumber}
                  </td>
                  {week.days.map((day) => {
                    const { status, booking } = getDayInfo(day, bookings);
                    const s = cellStyle(day);
                    const showMonth = day.getDate() === 1 || (week.days[0] === day);

                    return (
                      <td key={dateKey(day)} className="p-0.5 align-top">
                        <div
                          onClick={() => handleDayClick(day)}
                          onMouseEnter={() => selectStart && status !== "past" && setHoverDay(day)}
                          onMouseLeave={() => selectStart && setHoverDay(null)}
                          className="rounded-lg select-none transition-all"
                          style={{
                            background: s.bg,
                            border: `1px solid ${s.border}`,
                            cursor: s.cursor,
                            minHeight: 64,
                            padding: "6px 4px",
                          }}
                        >
                          <div className="text-center">
                            <span className="text-sm font-semibold" style={{ color: s.text }}>
                              {day.getDate()}
                            </span>
                            {showMonth && (
                              <span className="block text-[10px] leading-tight" style={{ color: s.text, opacity: 0.7 }}>
                                {MONTHS_SHORT[day.getMonth()]}
                              </span>
                            )}
                          </div>
                          {status === "booked_internal" && booking && (
                            <div className="mt-1 text-center">
                              {booking.guestName || booking.userName ? (
                                <span className="text-[10px] leading-tight truncate block" style={{ color: s.text, maxWidth: 64 }}>
                                  {booking.guestName || booking.userName}
                                </span>
                              ) : null}
                              {booking.numberOfPersons && (
                                <span className="text-[10px]" style={{ color: s.text, opacity: 0.7 }}>
                                  👤{booking.numberOfPersons}
                                  {booking.numberOfBoats ? ` 🚤${booking.numberOfBoats}` : ""}
                                </span>
                              )}
                            </div>
                          )}
                          {status === "booked_airbnb" && (
                            <div className="mt-1 text-center text-[10px]" style={{ color: s.text, opacity: 0.8 }}>
                              Airbnb
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating hint when selecting */}
      {selectStart && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl px-5 py-3 text-sm text-white shadow-xl"
          style={{ background: "rgba(79,70,229,0.95)", backdropFilter: "blur(10px)" }}
        >
          <span>
            Startdatum:{" "}
            <strong>{selectStart.toLocaleDateString("sv-SE", { day: "numeric", month: "long" })}</strong>
            {" "}— klicka nu på slutdatum
          </span>
          <button
            onClick={() => { setSelectStart(null); setHoverDay(null); }}
            className="text-indigo-200 hover:text-white text-lg leading-none"
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

// ─── Booking form modal ──────────────────────────────────────────────────────

function BookingFormModal({
  start, end, propertyId, onClose, onBooked,
}: {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // endDate in API is exclusive (day after last night)
    const endExclusive = new Date(endStr);
    endExclusive.setDate(endExclusive.getDate() + 1);

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId,
        startDate: startStr,
        endDate: dateKey(endExclusive),
        guestName: guestName || undefined,
        notes: notes || undefined,
        numberOfPersons: persons,
        numberOfBoats: boats,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Kunde inte skapa bokningen");
      return;
    }
    onBooked();
  }

  const nightCount = Math.max(0, (new Date(endStr).getTime() - new Date(startStr).getTime()) / 86400000) + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Ny bokning</h2>
            <p className="mt-0.5 text-xs text-gray-500">{nightCount} natt{nightCount !== 1 ? "er" : ""}</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl leading-none transition">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Incheckning</label>
              <input
                type="date"
                required
                value={startStr}
                onChange={(e) => setStartStr(e.target.value)}
                className="input-dark w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Utcheckning (sista natten)</label>
              <input
                type="date"
                required
                value={endStr}
                min={startStr}
                onChange={(e) => setEndStr(e.target.value)}
                className="input-dark w-full"
              />
            </div>
          </div>

          {/* Guest name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">
              Fiskegrupp / gästnamn <span className="text-gray-600">(valfritt)</span>
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="input-dark w-full"
              placeholder="Kowalski fiskesällskap"
            />
          </div>

          {/* Persons + Boats */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Antal personer</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPersons(Math.max(1, persons - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-medium text-gray-300 hover:text-white transition flex-shrink-0"
                  style={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.12)" }}
                >−</button>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={persons}
                  onChange={(e) => setPersons(Number(e.target.value))}
                  className="input-dark w-full text-center"
                />
                <button
                  type="button"
                  onClick={() => setPersons(persons + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-medium text-gray-300 hover:text-white transition flex-shrink-0"
                  style={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.12)" }}
                >+</button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Antal båtar att hyra</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBoats(Math.max(0, boats - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-medium text-gray-300 hover:text-white transition flex-shrink-0"
                  style={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.12)" }}
                >−</button>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={boats}
                  onChange={(e) => setBoats(Number(e.target.value))}
                  className="input-dark w-full text-center"
                />
                <button
                  type="button"
                  onClick={() => setBoats(boats + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-medium text-gray-300 hover:text-white transition flex-shrink-0"
                  style={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.12)" }}
                >+</button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">
              Anteckning <span className="text-gray-600">(valfritt)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-dark w-full resize-none"
              rows={2}
              placeholder="Önskemål, ankomstid, etc."
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
            >
              {loading ? "Bokar…" : "Bekräfta bokning"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Booking detail modal ────────────────────────────────────────────────────

function BookingDetailModal({
  booking, onClose, onDeleted,
}: {
  booking: Booking; onClose: () => void; onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Ta bort bokningen?")) return;
    setLoading(true);
    const res = await fetch(`/api/bookings/${booking.id}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      onDeleted();
    } else {
      const data = await res.json();
      alert(data.error || "Kunde inte ta bort bokningen");
    }
  }

  const start = new Date(booking.startDate);
  const end = new Date(booking.endDate);
  // endDate is exclusive — show last inclusive day
  const lastDay = new Date(end); lastDay.setDate(lastDay.getDate() - 1);
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);

  const fmt = (d: Date) => d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-base font-semibold text-white">
            {booking.guestName || booking.userName || "Bokning"}
          </h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl leading-none transition">✕</button>
        </div>

        <div className="space-y-3 text-sm">
          <Row label="Incheckning" value={fmt(start)} />
          <Row label="Utcheckning" value={fmt(lastDay)} />
          <Row label="Nätter" value={String(nights)} />
          {booking.numberOfPersons && <Row label="Antal personer" value={String(booking.numberOfPersons)} />}
          {booking.numberOfBoats != null && <Row label="Båtar" value={String(booking.numberOfBoats)} />}
          {booking.notes && <Row label="Anteckning" value={booking.notes} />}
          <Row
            label="Källa"
            value={booking.source === "AIRBNB" ? "Airbnb" : `Internbokning${booking.userName ? ` av ${booking.userName}` : ""}`}
          />
        </div>

        <div className="mt-5 flex justify-between">
          {booking.source !== "AIRBNB" ? (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="text-sm text-red-500 hover:text-red-400 transition disabled:opacity-60"
            >
              {loading ? "Tar bort…" : "Ta bort bokning"}
            </button>
          ) : <span />}
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className="text-white text-right">{value}</span>
    </div>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
