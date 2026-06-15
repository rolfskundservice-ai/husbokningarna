"use client";

import { useEffect, useState } from "react";

interface Property {
  id: string;
  name: string;
  color: string;
}

interface WeekMeta {
  weekNumber: number;
  year: number;
  label: string;
  startDate: string;
  endDate: string;
}

type Status = "AVAILABLE" | "BOOKED_INTERNAL" | "BOOKED_AIRBNB" | "PARTIAL";

interface CellData {
  status: Status;
  guestName: string | null;
  userName: string | null;
}

const CELL_BG: Record<Status, string> = {
  AVAILABLE: "rgba(34,197,94,0.12)",
  BOOKED_INTERNAL: "rgba(59,130,246,0.25)",
  BOOKED_AIRBNB: "rgba(249,115,22,0.25)",
  PARTIAL: "rgba(234,179,8,0.2)",
};

const CELL_BORDER: Record<Status, string> = {
  AVAILABLE: "rgba(34,197,94,0.2)",
  BOOKED_INTERNAL: "rgba(59,130,246,0.4)",
  BOOKED_AIRBNB: "rgba(249,115,22,0.4)",
  PARTIAL: "rgba(234,179,8,0.35)",
};

const STATUS_LABEL: Record<Status, string> = {
  AVAILABLE: "Ledig",
  BOOKED_INTERNAL: "Bokad",
  BOOKED_AIRBNB: "Airbnb",
  PARTIAL: "Delvis",
};

export function OverviewCalendar({ properties }: { properties: Property[] }) {
  const [weeksAhead, setWeeksAhead] = useState(16);
  const [grid, setGrid] = useState<Record<string, Record<string, CellData>>>({});
  const [weeks, setWeeks] = useState<WeekMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (properties.length === 0) return;

    setLoading(true);
    Promise.all(
      properties.map((p) =>
        fetch(`/api/availability/${p.id}?weeks=${weeksAhead}`)
          .then((r) => r.json())
          .then((data: { weekNumber: number; year: number; label: string; startDate: string; endDate: string; status: Status; bookings: { guestName: string | null; userName: string | null }[] }[]) => ({
            propertyId: p.id,
            weeks: data,
          }))
      )
    ).then((results) => {
      if (results[0]) {
        setWeeks(
          results[0].weeks.map((w) => ({
            weekNumber: w.weekNumber,
            year: w.year,
            label: w.label,
            startDate: w.startDate,
            endDate: w.endDate,
          }))
        );
      }

      const newGrid: Record<string, Record<string, CellData>> = {};
      for (const result of results) {
        newGrid[result.propertyId] = {};
        for (const w of result.weeks) {
          const key = `${w.year}-${w.weekNumber}`;
          newGrid[result.propertyId][key] = {
            status: w.status,
            guestName: w.bookings[0]?.guestName ?? null,
            userName: w.bookings[0]?.userName ?? null,
          };
        }
      }
      setGrid(newGrid);
      setLoading(false);
    });
  }, [properties, weeksAhead]);

  function handleExport() {
    const url = `/api/export?from=${weeks[0]?.startDate?.slice(0, 10) ?? ""}&to=${weeks[weeks.length - 1]?.endDate?.slice(0, 10) ?? ""}`;
    window.location.href = url;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <LegendDot color="rgba(34,197,94,0.5)" label="Ledig" />
          <LegendDot color="rgba(59,130,246,0.6)" label="Bokad (internt)" />
          <LegendDot color="rgba(249,115,22,0.6)" label="Bokad (Airbnb)" />
          <LegendDot color="rgba(234,179,8,0.5)" label="Delvis" />
        </div>
        <div className="flex items-center gap-2">
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
          <button
            onClick={handleExport}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition"
            style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
          >
            ↓ Exportera CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-600">Laddar översikt...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 py-2 pr-3 text-left text-gray-500 font-medium" style={{ background: "#0a0a0a", minWidth: "140px" }}>
                  Stuga
                </th>
                {weeks.map((w) => (
                  <th
                    key={`${w.year}-${w.weekNumber}`}
                    className="px-1 py-2 text-center text-gray-600 font-normal whitespace-nowrap"
                    style={{ minWidth: "56px" }}
                  >
                    {w.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id}>
                  <td
                    className="sticky left-0 z-10 py-1.5 pr-3 font-medium text-white whitespace-nowrap"
                    style={{ background: "#0a0a0a" }}
                  >
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </td>
                  {weeks.map((w) => {
                    const key = `${w.year}-${w.weekNumber}`;
                    const cell = grid[p.id]?.[key];
                    const status = cell?.status ?? "AVAILABLE";
                    const label = cell?.guestName || cell?.userName;
                    return (
                      <td key={key} className="px-0.5 py-1">
                        <div
                          className="rounded text-center px-1 py-1.5"
                          style={{
                            background: CELL_BG[status],
                            border: `1px solid ${CELL_BORDER[status]}`,
                          }}
                          title={label ? `${STATUS_LABEL[status]}: ${label}` : STATUS_LABEL[status]}
                        >
                          <div className="font-medium" style={{ color: status === "AVAILABLE" ? "#4ade80" : "#fff" }}>
                            {STATUS_LABEL[status]}
                          </div>
                          {label && status !== "AVAILABLE" && (
                            <div className="truncate text-gray-400 mt-0.5" style={{ maxWidth: "52px" }}>
                              {label}
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
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
