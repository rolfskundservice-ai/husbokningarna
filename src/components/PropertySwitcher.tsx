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
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
              p.id === active.id
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span
              className="mr-2 inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            {p.name}
          </button>
        ))}
      </div>

      {active.description && <p className="mb-4 text-sm text-gray-500">{active.description}</p>}

      <WeekCalendar key={active.id} propertyId={active.id} />
    </div>
  );
}
