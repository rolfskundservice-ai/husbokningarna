"use client";

import { useState } from "react";
import { Role } from "@prisma/client";

interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Förvaltare",
  OWNER: "Ägare",
  PARTNER: "Partner",
  CARETAKER: "Fastighetsskötare",
  CLEANER: "Städerska",
};

export function AdminUserList({ users: initial, currentUserId }: { users: UserDTO[]; currentUserId: string }) {
  const [users, setUsers] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Ta bort användaren?")) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } else {
      const data = await res.json();
      alert(data.error || "Kunde inte ta bort användaren");
    }
  }

  return (
    <div className="space-y-3">
      {users.map((u) =>
        editId === u.id ? (
          <EditUserRow
            key={u.id}
            user={u}
            onSaved={(updated) => {
              setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
              setEditId(null);
            }}
            onCancel={() => setEditId(null)}
          />
        ) : (
          <div
            key={u.id}
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{u.name}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: u.role === "ADMIN" ? "rgba(99,102,241,0.2)" : u.role === "OWNER" ? "rgba(34,197,94,0.15)" : u.role === "CARETAKER" ? "rgba(56,189,248,0.15)" : u.role === "CLEANER" ? "rgba(244,114,182,0.15)" : "rgba(249,115,22,0.15)",
                    color: u.role === "ADMIN" ? "#818cf8" : u.role === "OWNER" ? "#4ade80" : u.role === "CARETAKER" ? "#38bdf8" : u.role === "CLEANER" ? "#f472b6" : "#fb923c",
                  }}
                >
                  {ROLE_LABELS[u.role]}
                </span>
                {u.id === currentUserId && (
                  <span className="text-xs text-gray-600">(du)</span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{u.email}{u.phone && <span className="ml-2 text-gray-600">· {u.phone}</span>}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditId(u.id)}
                className="text-xs text-gray-500 hover:text-white transition"
              >
                Redigera
              </button>
              {u.id !== currentUserId && (
                <button
                  onClick={() => handleDelete(u.id)}
                  className="text-xs text-red-500 hover:text-red-400 transition"
                >
                  Ta bort
                </button>
              )}
            </div>
          </div>
        )
      )}

      {showAdd ? (
        <AddUserForm
          onCreated={(u) => {
            setUsers((prev) => [...prev, u]);
            setShowAdd(false);
          }}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full rounded-xl px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-300 transition text-left"
          style={{ border: "1px dashed rgba(255,255,255,0.15)", background: "transparent" }}
        >
          + Lägg till användare
        </button>
      )}
    </div>
  );
}

function EditUserRow({
  user,
  onSaved,
  onCancel,
}: {
  user: UserDTO;
  onSaved: (u: UserDTO) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);
    const body: Record<string, string> = { name, role, phone };
    if (password) body.password = password;

    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Kunde inte spara");
      return;
    }
    onSaved(await res.json());
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.12)" }}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-400">Namn</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-dark w-full" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400">Roll</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="input-dark w-full"
            style={{ background: "#1a1a1a", color: "#fff" }}
          >
            <option value="ADMIN">Förvaltare</option>
            <option value="OWNER">Ägare</option>
            <option value="PARTNER">Partner</option>
            <option value="CARETAKER">Fastighetsskötare</option>
            <option value="CLEANER">Städerska</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-400">Telefonnummer <span className="text-gray-600">(valfritt)</span></label>
        <input
          type="tel"
          autoComplete="off"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="input-dark w-full"
          placeholder="+46701234567"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-400">Nytt lösenord <span className="text-gray-600">(lämna tomt för att behålla)</span></label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-dark w-full"
          placeholder="••••••••"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
        >
          {loading ? "Sparar..." : "Spara"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:text-white transition"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          Avbryt
        </button>
      </div>
    </div>
  );
}

function AddUserForm({ onCreated, onCancel }: { onCreated: (u: UserDTO) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("PARTNER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role, phone: phone || undefined }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Kunde inte skapa användaren");
      return;
    }
    onCreated(await res.json());
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl p-4 space-y-3"
      style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <h3 className="text-sm font-semibold text-white">Ny användare</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-400">Namn</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input-dark w-full" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400">Roll</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input-dark w-full"
            style={{ background: "#1a1a1a", color: "#fff" }}>
            <option value="ADMIN">Förvaltare</option>
            <option value="OWNER">Ägare</option>
            <option value="PARTNER">Partner</option>
            <option value="CARETAKER">Fastighetsskötare</option>
            <option value="CLEANER">Städerska</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-400">E-post</label>
        <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-dark w-full" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-400">Telefonnummer <span className="text-gray-600">(valfritt)</span></label>
        <input type="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-dark w-full" placeholder="+46701234567" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-400">Lösenord</label>
        <input required type="password" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="input-dark w-full" placeholder="Minst 6 tecken" />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
        >
          {loading ? "Skapar..." : "Skapa"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:text-white transition"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          Avbryt
        </button>
      </div>
    </form>
  );
}
