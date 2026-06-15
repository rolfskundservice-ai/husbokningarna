"use client";

import { useState } from "react";
import type { WeekData } from "./WeekCalendar";

export function BookingModal({
  week,
  propertyId,
  onClose,
  onBooked,
  onDelete,
}: {
  week: WeekData;
  propertyId: string;
  onClose: () => void;
  onBooked: () => void;
  onDelete: (bookingId: string) => void;
}) {
  const [guestName, setGuestName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isAvailable = week.status === "AVAILABLE";

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId,
        startDate: week.startDate.slice(0, 10),
        endDate: week.endDate.slice(0, 10),
        guestName: guestName || undefined,
        notes: notes || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Kunde inte boka veckan");
      return;
    }

    onBooked();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-md rounded-xl p-6" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{week.label}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatDateRange(week.startDate, week.endDate)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition text-lg leading-none">
            ✕
          </button>
        </div>

        {isAvailable ? (
          <form onSubmit={handleBook} className="space-y-4">
            <p className="text-sm text-gray-500">Denna vecka är ledig. Boka den nedan:</p>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Gästnamn <span className="text-gray-600">(valfritt)</span>
              </label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="input-dark w-full"
                placeholder="Namn på fiskegrupp/gäst"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Anteckning <span className="text-gray-600">(valfritt)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-dark w-full resize-none"
                rows={2}
                placeholder="T.ex. antal gäster, önskemål..."
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex justify-end gap-2">
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
                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
              >
                {loading ? "Bokar..." : "Boka vecka"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            {week.bookings.map((b) => (
              <div key={b.id} className="rounded-lg p-3" style={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-sm font-medium text-white">
                  {b.guestName || b.userName || "Bokad"}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {b.source === "AIRBNB" ? "Bokad via Airbnb" : `Bokad av ${b.userName ?? "okänd"}`}
                </div>
                {b.notes && (
                  <div className="mt-2 text-xs text-gray-400 italic">
                    📝 {b.notes}
                  </div>
                )}
                {b.source !== "AIRBNB" && (
                  <button
                    onClick={() => onDelete(b.id)}
                    className="mt-2 text-xs font-medium text-red-500 hover:text-red-400 transition"
                  >
                    Ta bort bokning
                  </button>
                )}
              </div>
            ))}
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Stäng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  e.setDate(e.getDate() - 1);
  const fmt = (d: Date) => d.toLocaleDateString("sv-SE", { day: "numeric", month: "long" });
  return `${fmt(s)} – ${fmt(e)}`;
}
