import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BookingStatus } from "@prisma/client";
import { Navbar } from "@/components/Navbar";
import { formatBoatNumbers, parseBoatNumbers } from "@/lib/boats";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function daysUntil(iso: string) {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export default async function StaffPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  if (role !== "CARETAKER" && role !== "CLEANER") redirect("/dashboard");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoWeeksAhead = new Date(today);
  twoWeeksAhead.setDate(today.getDate() + 14);

  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      OR: [
        { startDate: { gte: today, lt: twoWeeksAhead } },
        { endDate: { gt: today, lte: twoWeeksAhead } },
      ],
    },
    include: { property: { select: { name: true, color: true } } },
    orderBy: { startDate: "asc" },
  });

  const roleLabel = role === "CARETAKER" ? "Fastighetsskötare" : "Städerska";

  // Samla unika datum med händelser
  const eventsByDate = new Map<string, { checkins: typeof bookings; checkouts: typeof bookings }>();

  for (const b of bookings) {
    const startKey = b.startDate.toISOString().slice(0, 10);
    const endKey = b.endDate.toISOString().slice(0, 10);

    if (!eventsByDate.has(startKey)) eventsByDate.set(startKey, { checkins: [], checkouts: [] });
    if (!eventsByDate.has(endKey)) eventsByDate.set(endKey, { checkins: [], checkouts: [] });

    const d = new Date(b.startDate);
    d.setHours(0, 0, 0, 0);
    if (d >= today && d < twoWeeksAhead) eventsByDate.get(startKey)!.checkins.push(b);

    const e = new Date(b.endDate);
    e.setHours(0, 0, 0, 0);
    if (e > today && e <= twoWeeksAhead) eventsByDate.get(endKey)!.checkouts.push(b);
  }

  const sortedDates = Array.from(eventsByDate.entries())
    .filter(([, v]) => v.checkins.length > 0 || v.checkouts.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="min-h-screen" style={{ background: "#0a0d14" }}>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <p className="text-xs font-bold tracking-widest uppercase text-indigo-400 mb-1">{roleLabel}</p>
          <h1 className="text-2xl font-bold text-white">Kommande 14 dagar</h1>
          <p className="text-sm text-gray-500 mt-1">Incheckningar och utcheckningar</p>
        </div>

        {sortedDates.length === 0 ? (
          <div className="rounded-xl px-6 py-12 text-center" style={{ background: "#0e1320", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-gray-500 text-sm">Inga incheckningar eller utcheckningar de närmaste 14 dagarna.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map(([dateKey, { checkins, checkouts }]) => {
              const diff = daysUntil(dateKey);
              const dayLabel = diff === 0 ? "Idag" : diff === 1 ? "Imorgon" : `Om ${diff} dagar`;
              const dayColor = diff === 0 ? "#4ade80" : diff === 1 ? "#facc15" : "#94a3b8";

              return (
                <div key={dateKey}>
                  {/* Datumrubrik */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-bold" style={{ color: dayColor }}>{dayLabel}</span>
                    <span className="text-sm text-gray-600">
                      {new Date(dateKey).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Utcheckningar */}
                    {checkouts.map(b => (
                      <div key={`out-${b.id}`} className="rounded-xl overflow-hidden"
                        style={{ border: "1px solid rgba(220,38,38,0.3)", background: "#0e1320" }}>
                        <div className="flex items-center gap-3 px-4 py-2"
                          style={{ background: "rgba(220,38,38,0.15)", borderBottom: "1px solid rgba(220,38,38,0.2)" }}>
                          <span className="text-xs font-bold text-red-400 tracking-widest uppercase">Utcheckning</span>
                          <span className="text-xs font-semibold" style={{ color: b.property.color }}>
                            {b.property.name}
                          </span>
                        </div>
                        <div className="px-4 py-3 space-y-1.5">
                          <p className="text-sm font-semibold text-white">{b.guestName || "Okänd gäst"}</p>
                          {b.numberOfPersons && (
                            <p className="text-xs text-gray-500">👤 {b.numberOfPersons} person{b.numberOfPersons !== 1 ? "er" : ""}</p>
                          )}
                          {role === "CLEANER" && b.cleaning && (
                            <p className="text-xs font-semibold text-green-400">🧹 Städning beställd</p>
                          )}
                          {b.bedLinen && (
                            <p className="text-xs text-purple-400">🛏 Lakan</p>
                          )}
                          {b.notes && (
                            <p className="text-xs text-gray-500 italic">📝 {b.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Incheckningar */}
                    {checkins.map(b => {
                      const boatNums = parseBoatNumbers(b.boatNumbers);
                      return (
                        <div key={`in-${b.id}`} className="rounded-xl overflow-hidden"
                          style={{ border: "1px solid rgba(59,130,246,0.3)", background: "#0e1320" }}>
                          <div className="flex items-center gap-3 px-4 py-2"
                            style={{ background: "rgba(59,130,246,0.15)", borderBottom: "1px solid rgba(59,130,246,0.2)" }}>
                            <span className="text-xs font-bold text-blue-400 tracking-widest uppercase">Incheckning</span>
                            <span className="text-xs font-semibold" style={{ color: b.property.color }}>
                              {b.property.name}
                            </span>
                          </div>
                          <div className="px-4 py-3 space-y-1.5">
                            <p className="text-sm font-semibold text-white">{b.guestName || "Okänd gäst"}</p>
                            <p className="text-xs text-gray-500">
                              {fmt(b.startDate.toISOString())} → {fmt(b.endDate.toISOString())}
                            </p>
                            {b.numberOfPersons && (
                              <p className="text-xs text-gray-500">👤 {b.numberOfPersons} person{b.numberOfPersons !== 1 ? "er" : ""}</p>
                            )}
                            {boatNums.length > 0 && role === "CARETAKER" && (
                              <p className="text-xs text-blue-400">🚤 {formatBoatNumbers(boatNums)}</p>
                            )}
                            {b.cleaning && (
                              <p className="text-xs text-green-400">🧹 Städning beställd</p>
                            )}
                            {b.bedLinen && (
                              <p className="text-xs text-purple-400">🛏 Lakan</p>
                            )}
                            {b.notes && (
                              <p className="text-xs text-gray-500 italic">📝 {b.notes}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
