"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";

const LANG_OPTIONS = [
  { value: "sv", label: "Svenska", flag: "🇸🇪" },
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "pl", label: "Polski", flag: "🇵🇱" },
];

export default function ChangePasswordPage() {
  const { data: session, update } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [langSaved, setLangSaved] = useState(false);

  // @ts-expect-error - custom field
  const currentLang = (session?.user?.language as string) ?? "sv";

  async function handleLangChange(lang: string) {
    await fetch("/api/account/language", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang }),
    });
    await update({ language: lang });
    setLangSaved(true);
    setTimeout(() => setLangSaved(false), 2000);
    window.location.reload();
  }

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

        {/* Språkval */}
        <div className="mb-6 rounded-xl p-6" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 className="text-sm font-semibold text-white mb-3">Språk / Language / Język</h2>
          <div className="flex gap-2">
            {LANG_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleLangChange(opt.value)}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition"
                style={{
                  background: currentLang === opt.value ? "linear-gradient(135deg,#2563eb,#7c3aed)" : "rgba(255,255,255,0.06)",
                  color: currentLang === opt.value ? "#fff" : "#9ca3af",
                  border: `1px solid ${currentLang === opt.value ? "transparent" : "rgba(255,255,255,0.1)"}`,
                }}
              >
                {opt.flag} {opt.label}
              </button>
            ))}
          </div>
          {langSaved && <p className="mt-2 text-xs text-green-400">Sparat!</p>}
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
