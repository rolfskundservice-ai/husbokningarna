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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">{week.label}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        {isAvailable ? (
          <form onSubmit={handleBook} className="space-y-4">
            <p className="text-sm text-gray-500">Denna vecka är ledig. Boka den här:</p>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Gästnamn (valfritt)
              </label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Namn på fiskegrupp/gäst"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Anteckning (valfritt)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                rows={2}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {loading ? "Bokar..." : "Boka vecka"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            {week.bookings.map((b) => (
              <div key={b.id} className="rounded-lg border border-gray-200 p-3">
                <div className="text-sm font-medium">
                  {b.guestName || b.userName || "Bokad"}
                </div>
                <div className="text-xs text-gray-500">
                  {b.source === "AIRBNB" ? "Bokad via Airbnb" : `Bokad av ${b.userName ?? "okänd"}`}
                </div>
                {b.source !== "AIRBNB" && (
                  <button
                    onClick={() => onDelete(b.id)}
                    className="mt-2 text-xs font-medium text-red-600 hover:underline"
                  >
                    Ta bort bokning
                  </button>
                )}
              </div>
            ))}
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
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
