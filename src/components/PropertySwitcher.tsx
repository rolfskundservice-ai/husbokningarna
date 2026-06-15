"use client";

import { useState } from "react";
import { WeekCalendar } from "@/components/WeekCalendar";

interface Property {
  id: string;
  name: string;
  description: string | null;
  color: string;
}

export function PropertySwitcher({ properties }: { properties: Property[] }) {
  const [activeId, setActiveId] = useState(properties[0]?.id);

  if (properties.length === 0) {
    return <p className="text-gray-500">Inga stugor tillgängliga för ditt konto ännu.</p>;
  }

  const active = properties.find((p) => p.id === activeId) ?? properties[0];

  return (
    <div>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {properties.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveId(p.id)}
            className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition"
            style={
              p.id === active.id
                ? { background: p.color, color: "#fff", border: `1px solid ${p.color}` }
                : { background: "#1c1c1c", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }
            }
          >
            <span
              className="mr-2 inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: p.id === active.id ? "rgba(255,255,255,0.7)" : p.color }}
            />
            {p.name}
          </button>
        ))}
      </div>

      {active.description && (
        <p className="mb-4 text-sm text-gray-500">{active.description}</p>
      )}

      <WeekCalendar key={active.id} propertyId={active.id} />
    </div>
  );
}
