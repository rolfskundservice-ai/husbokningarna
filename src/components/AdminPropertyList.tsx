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
          className="w-full rounded-xl px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-300 transition text-left"
          style={{ border: "1px dashed rgba(255,255,255,0.15)", background: "transparent" }}
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
    <div className="rounded-xl p-4" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: property.color }} />
        <h2 className="font-medium text-white">{property.name}</h2>
      </div>
      {property.description && (
        <p className="mb-3 text-sm text-gray-500">{property.description}</p>
      )}

      {/* Import från Airbnb */}
      <label className="mb-1 block text-sm font-medium text-gray-400">
        Airbnb → Systemet <span className="text-gray-600 font-normal">(klistra in iCal-länk från Airbnb)</span>
      </label>
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.airbnb.com/calendar/ical/12345.ics?s=..."
          className="input-dark min-w-0 flex-1"
        />
        <button
          onClick={() => onSaveIcal(property.id, url)}
          disabled={saving}
          className="rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:text-white transition disabled:opacity-60"
          style={{ border: "1px solid rgba(255,255,255,0.12)", background: "#1c1c1c" }}
        >
          {saving ? "Sparar..." : "Spara"}
        </button>
        <button
          onClick={() => onSync(property.id)}
          disabled={syncing || !property.airbnbIcalUrl}
          className="rounded-lg px-3 py-2 text-sm font-medium text-white transition disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
        >
          {syncing ? "Synkar..." : "Synka nu"}
        </button>
      </div>
      <p className="mb-4 text-xs text-gray-600">
        {property.lastSyncedAt
          ? `Senast synkad: ${new Date(property.lastSyncedAt).toLocaleString("sv-SE")}`
          : "Aldrig synkad"}
      </p>

      {/* Export till Airbnb */}
      <label className="mb-1 block text-sm font-medium text-gray-400">
        Systemet → Airbnb <span className="text-gray-600 font-normal">(lägg till denna länk i Airbnb)</span>
      </label>
      <ExportUrlRow propertyId={property.id} />
    </div>
  );
}

function ExportUrlRow({ propertyId }: { propertyId: string }) {
  const [copied, setCopied] = useState(false);
  const base = typeof window !== "undefined" ? window.location.origin : "https://husbokningarnas.vercel.app";
  const exportUrl = `${base}/api/ical/${propertyId}`;

  function copy() {
    navigator.clipboard.writeText(exportUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex gap-2 items-center">
      <input
        readOnly
        value={exportUrl}
        className="input-dark min-w-0 flex-1 text-xs text-gray-400 cursor-text"
        onFocus={e => e.target.select()}
      />
      <button
        onClick={copy}
        className="rounded-lg px-3 py-2 text-sm font-medium transition whitespace-nowrap"
        style={{
          background: copied ? "rgba(34,197,94,0.15)" : "#1c1c1c",
          border: copied ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.12)",
          color: copied ? "#4ade80" : "#9ca3af",
        }}
      >
        {copied ? "✓ Kopierad!" : "Kopiera"}
      </button>
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
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl p-4"
      style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <h3 className="text-sm font-semibold text-white">Ny stuga</h3>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-400">Namn</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-dark w-full"
          placeholder="Stuga 4 - ..."
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-400">Beskrivning</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input-dark w-full"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-400">Färg</label>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-9 w-16 rounded border cursor-pointer"
          style={{ border: "1px solid rgba(255,255,255,0.12)", background: "#1c1c1c" }}
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
        >
          {loading ? "Skapar..." : "Skapa stuga"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          Avbryt
        </button>
      </div>
    </form>
  );
}
