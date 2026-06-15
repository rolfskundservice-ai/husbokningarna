"use client";

import { useState } from "react";
import type { PropertyDTO } from "@/types";

export function AdminPropertyList({ properties: initial }: { properties: PropertyDTO[] }) {
  const [properties, setProperties] = useState(initial);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  async function handleSaveIcal(id: string, airbnbIcalUrl: string) {
    setSavingId(id);
    const res = await fetch(`/api/properties/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ airbnbIcalUrl }),
    });
    setSavingId(null);
    if (res.ok) {
      const updated = await res.json();
      setProperties((prev) =>
        prev.map((p) => (p.id === id ? { ...p, airbnbIcalUrl: updated.airbnbIcalUrl } : p))
      );
    } else {
      alert("Kunde inte spara länken");
    }
  }

  async function handleSync(id: string) {
    setSyncing(id);
    const res = await fetch("/api/sync/airbnb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: id }),
    });
    setSyncing(null);
    const data = await res.json();
    if (res.ok) {
      const result = data[id];
      if (result?.skipped) {
        alert("Ingen Airbnb-länk angiven för denna stuga.");
      } else {
        alert(`Synkad! ${result.synced} bokningar uppdaterade, ${result.removed} borttagna.`);
        setProperties((prev) =>
          prev.map((p) => (p.id === id ? { ...p, lastSyncedAt: new Date().toISOString() } : p))
        );
      }
    } else {
      alert(data.error || "Synk misslyckades");
    }
  }

  return (
    <div className="space-y-4">
      {properties.map((property) => (
        <PropertyRow
          key={property.id}
          property={property}
          onSaveIcal={handleSaveIcal}
          onSync={handleSync}
          saving={savingId === property.id}
          syncing={syncing === property.id}
        />
      ))}

      {showAddForm ? (
        <AddPropertyForm
          onCreated={(p) => {
            setProperties((prev) => [...prev, p]);
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50"
        >
          + Lägg till stuga
        </button>
      )}
    </div>
  );
}

function PropertyRow({
  property,
  onSaveIcal,
  onSync,
  saving,
  syncing,
}: {
  property: PropertyDTO;
  onSaveIcal: (id: string, url: string) => void;
  onSync: (id: string) => void;
  saving: boolean;
  syncing: boolean;
}) {
  const [url, setUrl] = useState(property.airbnbIcalUrl ?? "");

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: property.color }} />
        <h2 className="font-medium">{property.name}</h2>
      </div>
      {property.description && <p className="mb-3 text-sm text-gray-500">{property.description}</p>}

      <label className="mb-1 block text-sm font-medium text-gray-700">Airbnb iCal-URL</label>
      <div className="flex flex-wrap gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.airbnb.com/calendar/ical/12345.ics?s=..."
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          onClick={() => onSaveIcal(property.id, url)}
          disabled={saving}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          {saving ? "Sparar..." : "Spara"}
        </button>
        <button
          onClick={() => onSync(property.id)}
          disabled={syncing || !property.airbnbIcalUrl}
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {syncing ? "Synkar..." : "Synka nu"}
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        {property.lastSyncedAt
          ? `Senast synkad: ${new Date(property.lastSyncedAt).toLocaleString("sv-SE")}`
          : "Aldrig synkad"}
      </p>
    </div>
  );
}

function AddPropertyForm({
  onCreated,
  onCancel,
}: {
  onCreated: (p: PropertyDTO) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#2563eb");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, color }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Kunde inte skapa stugan");
      return;
    }

    const created = await res.json();
    onCreated({ ...created, lastSyncedAt: null });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Namn</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="Stuga 4 - ..."
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Beskrivning</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Färg (kalendermarkering)</label>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-9 w-16 rounded border border-gray-300"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Skapar..." : "Skapa stuga"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Avbryt
        </button>
      </div>
    </form>
  );
}
