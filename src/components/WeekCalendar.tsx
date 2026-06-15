"use client";

import { useEffect, useState, useCallback } from "react";
import { BookingModal } from "./BookingModal";

export interface WeekData {
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  label: string;
  status: "AVAILABLE" | "BOOKED_INTERNAL" | "BOOKED_AIRBNB" | "PARTIAL";
  bookings: {
    id: string;
    startDate: string;
    endDate: string;
    guestName: string | null;
    source: "INTERNAL" | "AIRBNB" | "MANUAL";
    userName: string | null;
  }[];
}

const STATUS_STYLES: Record<WeekData["status"], string> = {
  AVAILABLE: "bg-green-50 border-green-200 hover:bg-green-100",
  BOOKED_INTERNAL: "bg-blue-50 border-blue-200",
  BOOKED_AIRBNB: "bg-orange-50 border-orange-200",
  PARTIAL: "bg-yellow-50 border-yellow-200",
};

const STATUS_LABELS: Record<WeekData["status"], string> = {
  AVAILABLE: "Ledig",
  BOOKED_INTERNAL: "Bokad (internt)",
  BOOKED_AIRBNB: "Bokad (Airbnb)",
  PARTIAL: "Delvis bokad",
};

export function WeekCalendar({ propertyId }: { propertyId: string }) {
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<WeekData | null>(null);
  const [weeksAhead, setWeeksAhead] = useState(16);

  const fetchAvailability = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/availability/${propertyId}?weeks=${weeksAhead}`);
    if (res.ok) {
      const data = await res.json();
      setWeeks(data);
    }
    setLoading(false);
  }, [propertyId, weeksAhead]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  async function handleDelete(bookingId: string) {
    const res = await fetch(`/api/bookings/${bookingId}`, { method: "DELETE" });
    if (res.ok) {
      setSelectedWeek(null);
      fetchAvailability();
    } else {
      const data = await res.json();
      alert(data.error || "Kunde inte ta bort bokningen");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Legend />
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Visa</span>
          <select
            value={weeksAhead}
            onChange={(e) => setWeeksAhead(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-2 py-1"
          >
            <option value={8}>8 veckor</option>
            <option value={16}>16 veckor</option>
            <option value={26}>26 veckor</option>
            <option value={52}>52 veckor</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">Laddar kalender...</div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {weeks.map((week) => (
            <button
              key={`${week.year}-${week.weekNumber}`}
              onClick={() => setSelectedWeek(week)}
              className={`rounded-lg border p-3 text-left transition ${STATUS_STYLES[week.status]}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{week.label}</span>
              </div>
              <div className="mt-1 text-xs text-gray-600">
                {formatDateRange(week.startDate, week.endDate)}
              </div>
              <div className="mt-2 text-xs font-medium">{STATUS_LABELS[week.status]}</div>
              {week.bookings.map((b) => (
                <div key={b.id} className="mt-1 truncate text-xs text-gray-500">
                  {b.guestName || b.userName || "Bokad"}
                  {b.source === "AIRBNB" && " · Airbnb"}
                </div>
              ))}
            </button>
          ))}
        </div>
      )}

      {selectedWeek && (
        <BookingModal
          week={selectedWeek}
          propertyId={propertyId}
          onClose={() => setSelectedWeek(null)}
          onBooked={() => {
            setSelectedWeek(null);
            fetchAvailability();
          }}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
      <LegendItem color="bg-green-100 border-green-300" label="Ledig" />
      <LegendItem color="bg-blue-100 border-blue-300" label="Bokad (internt)" />
      <LegendItem color="bg-orange-100 border-orange-300" label="Bokad (Airbnb)" />
      <LegendItem color="bg-yellow-100 border-yellow-300" label="Delvis bokad" />
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-3 w-3 rounded border ${color}`} />
      {label}
    </span>
  );
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  // end är exklusiv (nästa veckas start), visa sista dagen som end - 1
  const e = new Date(end);
  e.setDate(e.getDate() - 1);
  const fmt = (d: Date) => d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
  return `${fmt(s)} – ${fmt(e)}`;
}
