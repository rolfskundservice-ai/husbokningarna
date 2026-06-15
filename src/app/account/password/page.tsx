"use client";

import { useState } from "react";
import { Navbar } from "@/components/Navbar";

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (next !== confirm) {
      setError("De nya lösenorden matchar inte");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Något gick fel");
      return;
    }

    setSuccess(true);
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-md px-4 py-12">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Byt lösenord</h1>
          <p className="mt-1 text-sm text-gray-500">Välj ett nytt lösenord för ditt konto.</p>
        </div>

        <div className="rounded-xl p-6" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)" }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Nuvarande lösenord</label>
              <input
                type="password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="input-dark w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Nytt lösenord</label>
              <input
                type="password"
                required
                minLength={6}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className="input-dark w-full"
                placeholder="Minst 6 tecken"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Bekräfta nytt lösenord</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input-dark w-full"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            {success && <p className="text-sm text-green-400">Lösenordet har bytts!</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-2 text-sm font-medium text-white transition disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
            >
              {loading ? "Sparar..." : "Byt lösenord"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
