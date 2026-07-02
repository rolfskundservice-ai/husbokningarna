import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BookingStatus } from "@prisma/client";
import { Navbar } from "@/components/Navbar";
import { BOAT_TYPES, BoatId, formatBoatNumbers, parseBoatNumbers, boatSummary } from "@/lib/boats";

function fmtDate(d: Date) {
  return d.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });
}

function fmtFull(d: Date) {
  return d.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });
}

function daysUntil(d: Date) {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(d); target.setHours(0,0,0,0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function boatInfo(b: { boatNumbers: string; boat6hp: number; boat99hp: number; boat20hp: number; boat25hp: number }) {
  const nums = parseBoatNumbers(b.boatNumbers);
  const counts = { boat6hp: b.boat6hp, boat99hp: b.boat99hp, boat20hp: b.boat20hp, boat25hp: b.boat25hp };
  const hasAny = BOAT_TYPES.some(t => counts[t.id as BoatId] > 0);
  if (!hasAny) return null;

  // Typrad: "2× 6 hk, 1× 20 hk"
  const types = BOAT_TYPES
    .filter(t => counts[t.id as BoatId] > 0)
    .map(t => `${counts[t.id as BoatId]}× ${t.label}`)
    .join(", ");

  // Nummer om tillgängliga
  const numStr = nums.length > 0 ? formatBoatNumbers(nums) : null;

  return { types, numStr };
}

export default async function StaffPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  if (role !== "CARETAKER" && role !== "CLEANER") redirect("/dashboard");

  const today = new Date(); today.setHours(0,0,0,0);
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

  // Gruppera per datum
  const eventsByDate = new Map<string, { checkins: typeof bookings; checkouts: typeof bookings }>();

  for (const b of bookings) {
    const sk = b.startDate.toISOString().slice(0,10);
    const ek = b.endDate.toISOString().slice(0,10);
    if (!eventsByDate.has(sk)) eventsByDate.set(sk, { checkins: [], checkouts: [] });
    if (!eventsByDate.has(ek)) eventsByDate.set(ek, { checkins: [], checkouts: [] });

    const s = new Date(b.startDate); s.setHours(0,0,0,0);
    if (s >= today) eventsByDate.get(sk)!.checkins.push(b);

    const e = new Date(b.endDate); e.setHours(0,0,0,0);
    if (e > today) eventsByDate.get(ek)!.checkouts.push(b);
  }

  const sortedDates = Array.from(eventsByDate.entries())
    .filter(([, v]) => v.checkins.length > 0 || v.checkouts.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  const isCaretaker = role === "CARETAKER";
  const roleLabel = isCaretaker ? "Fastighetsskötare" : "Städerska";

  // Räkna idag
  const todayKey = today.toISOString().slice(0,10);
  const todayEvents = eventsByDate.get(todayKey);
  const todayCount = (todayEvents?.checkins.length ?? 0) + (todayEvents?.checkouts.length ?? 0);

  return (
    <div className="min-h-screen" style={{ background: "#0a0d14" }}>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "#818cf8" }}>{roleLabel}</p>
          <h1 className="text-2xl font-bold text-white">Kommande 14 dagar</h1>
        </div>

        {/* Idag-banner */}
        {todayCount > 0 && (
          <div className="rounded-xl px-5 py-4 mb-6 flex items-center gap-3"
            style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.4)" }}>
            <span className="text-2xl">📋</span>
            <div>
              <p className="text-sm font-bold text-white">Idag: {todayCount} händelse{todayCount !== 1 ? "r" : ""}</p>
              <p className="text-xs text-indigo-300">
                {(todayEvents?.checkins.length ?? 0) > 0 && `${todayEvents!.checkins.length} incheckning${todayEvents!.checkins.length !== 1 ? "ar" : ""}`}
                {(todayEvents?.checkins.length ?? 0) > 0 && (todayEvents?.checkouts.length ?? 0) > 0 && " · "}
                {(todayEvents?.checkouts.length ?? 0) > 0 && `${todayEvents!.checkouts.length} utcheckning${todayEvents!.checkouts.length !== 1 ? "ar" : ""}`}
              </p>
            </div>
          </div>
        )}

        {sortedDates.length === 0 ? (
          <div className="rounded-xl px-6 py-14 text-center"
            style={{ background: "#0e1320", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-4xl mb-3">✅</p>
            <p className="text-white font-semibold mb-1">Lugnt framöver</p>
            <p className="text-gray-500 text-sm">Inga incheckningar eller utcheckningar de närmaste 14 dagarna.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedDates.map(([dateKey, { checkins, checkouts }]) => {
              const diff = daysUntil(new Date(dateKey));
              const dayLabel = diff === 0 ? "Idag" : diff === 1 ? "Imorgon" : `Om ${diff} dagar`;
              const dayColor = diff === 0 ? "#4ade80" : diff === 1 ? "#facc15" : "#6b7280";
              const dateObj = new Date(dateKey + "T12:00:00");

              return (
                <div key={dateKey}>
                  {/* Datumrubrik */}
                  <div className="flex items-baseline gap-3 mb-3 pb-2"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="text-base font-bold" style={{ color: dayColor }}>{dayLabel}</span>
                    <span className="text-sm" style={{ color: "#4b5563" }}>{fmtFull(dateObj)}</span>
                  </div>

                  <div className="space-y-3">

                    {/* UTCHECKNINGAR */}
                    {checkouts.map(b => {
                      const nights = Math.round((b.endDate.getTime() - b.startDate.getTime()) / 86400000);
                      const boats = boatInfo(b);
                      return (
                        <div key={`out-${b.id}`} className="rounded-xl overflow-hidden"
                          style={{ border: "1px solid rgba(220,38,38,0.25)", background: "#0e1320" }}>

                          {/* Topplist */}
                          <div className="flex items-center justify-between px-4 py-2.5"
                            style={{ background: "rgba(220,38,38,0.12)", borderBottom: "1px solid rgba(220,38,38,0.2)" }}>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black tracking-widest uppercase text-red-400">Utcheckning</span>
                              <span className="text-xs font-bold" style={{ color: b.property.color }}>
                                · {b.property.name}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-600">{nights} nätter</span>
                          </div>

                          {/* Innehåll */}
                          <div className="px-4 py-4">
                            <p className="text-base font-bold text-white mb-3">{b.guestName || "Okänd gäst"}</p>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                              <InfoRow label="Incheckning" value={fmtDate(b.startDate)} />
                              <InfoRow label="Utcheckning" value={fmtDate(b.endDate)} />
                              {b.numberOfPersons && (
                                <InfoRow label="Antal personer" value={`${b.numberOfPersons} pers.`} />
                              )}
                            </div>

                            {/* Städning — extra tydlig för städerska */}
                            {b.cleaning && (
                              <div className="mt-3 rounded-lg px-3 py-2.5 flex items-center gap-2"
                                style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}>
                                <span className="text-base">🧹</span>
                                <span className="text-sm font-bold text-green-400">Städning beställd</span>
                              </div>
                            )}
                            {b.bedLinen && (
                              <div className="mt-2 rounded-lg px-3 py-2.5 flex items-center gap-2"
                                style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)" }}>
                                <span className="text-base">🛏</span>
                                <span className="text-sm font-bold text-purple-400">Lakan beställt</span>
                              </div>
                            )}
                            {isCaretaker && boats && (
                              <div className="mt-2 rounded-lg px-3 py-2.5"
                                style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)" }}>
                                <p className="text-xs text-gray-500 mb-0.5">Återlämna båtar</p>
                                {boats.numStr && <p className="text-sm font-bold text-blue-400">{boats.numStr}</p>}
                                <p className="text-xs text-gray-400">{boats.types}</p>
                              </div>
                            )}
                            {b.notes && (
                              <div className="mt-2 rounded-lg px-3 py-2.5"
                                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                <p className="text-xs text-gray-500 mb-0.5">Anteckning</p>
                                <p className="text-sm text-gray-300">{b.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* INCHECKNINGAR */}
                    {checkins.map(b => {
                      const nights = Math.round((b.endDate.getTime() - b.startDate.getTime()) / 86400000);
                      const boats = boatInfo(b);
                      return (
                        <div key={`in-${b.id}`} className="rounded-xl overflow-hidden"
                          style={{ border: "1px solid rgba(59,130,246,0.3)", background: "#0e1320" }}>

                          {/* Topplist */}
                          <div className="flex items-center justify-between px-4 py-2.5"
                            style={{ background: "rgba(59,130,246,0.12)", borderBottom: "1px solid rgba(59,130,246,0.2)" }}>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black tracking-widest uppercase text-blue-400">Incheckning</span>
                              <span className="text-xs font-bold" style={{ color: b.property.color }}>
                                · {b.property.name}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-600">{nights} nätter</span>
                          </div>

                          {/* Innehåll */}
                          <div className="px-4 py-4">
                            <p className="text-base font-bold text-white mb-3">{b.guestName || "Okänd gäst"}</p>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
                              <InfoRow label="Incheckning" value={fmtDate(b.startDate)} />
                              <InfoRow label="Utcheckning" value={fmtDate(b.endDate)} />
                              {b.numberOfPersons && (
                                <InfoRow label="Antal personer" value={`${b.numberOfPersons} pers.`} />
                              )}
                              <InfoRow label="Vistelse" value={`${nights} nätter`} />
                            </div>

                            {/* Båtar — kärnan för fastighetsskötaren */}
                            {isCaretaker && boats ? (
                              <div className="rounded-lg px-3 py-3 mb-2"
                                style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.35)" }}>
                                <p className="text-xs text-blue-300 font-bold uppercase tracking-wider mb-1.5">🚤 Båtar</p>
                                {boats.numStr ? (
                                  <>
                                    <p className="text-sm font-black text-white mb-0.5">{boats.numStr}</p>
                                    <p className="text-xs text-gray-400">{boats.types}</p>
                                  </>
                                ) : (
                                  <p className="text-sm font-bold text-blue-300">{boats.types}</p>
                                )}
                              </div>
                            ) : isCaretaker && (
                              <div className="rounded-lg px-3 py-2.5 mb-2"
                                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                <p className="text-sm text-gray-600">🚤 Inga båtar bokade</p>
                              </div>
                            )}

                            {b.cleaning && (
                              <div className="rounded-lg px-3 py-2.5 mb-2 flex items-center gap-2"
                                style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}>
                                <span>🧹</span>
                                <span className="text-sm font-bold text-green-400">Städning beställd</span>
                              </div>
                            )}
                            {b.bedLinen && (
                              <div className="rounded-lg px-3 py-2.5 mb-2 flex items-center gap-2"
                                style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)" }}>
                                <span>🛏</span>
                                <span className="text-sm font-bold text-purple-400">Lakan beställt</span>
                              </div>
                            )}
                            {b.notes && (
                              <div className="rounded-lg px-3 py-2.5"
                                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                <p className="text-xs text-gray-500 mb-0.5">Anteckning</p>
                                <p className="text-sm text-gray-300">{b.notes}</p>
                              </div>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-gray-600 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-200 font-medium">{value}</p>
    </div>
  );
}
