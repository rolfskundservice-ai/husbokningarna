"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

const LANG_FLAGS: Record<string, string> = { sv: "🇸🇪", en: "🇬🇧", pl: "🇵🇱" };
const LANGS = ["sv", "en", "pl"];

export function Navbar() {
  const { data: session, update } = useSession();
  // @ts-expect-error - custom field
  const currentLang = (session?.user?.language as string) ?? "sv";

  async function handleLangChange(lang: string) {
    await fetch("/api/account/language", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang }),
    });
    await update({ language: lang });
    window.location.reload();
  }

  return (
    <nav style={{ background: "#0f0f0f", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-base font-semibold text-white">
            🏡 Stugbokning
          </Link>
          {session?.user?.role !== "CARETAKER" && session?.user?.role !== "CLEANER" && (
            <>
              <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition">
                Kalender
              </Link>
              <Link href="/overview" className="text-sm text-gray-400 hover:text-white transition">
                Översikt
              </Link>
            </>
          )}
          {(session?.user?.role === "CARETAKER" || session?.user?.role === "CLEANER") && (
            <Link href="/staff" className="text-sm text-gray-400 hover:text-white transition">
              Incheckningar
            </Link>
          )}
          {session?.user?.role === "ADMIN" && (
            <>
              <Link href="/admin/properties" className="text-sm text-gray-400 hover:text-white transition">
                Stugor
              </Link>
              <Link href="/admin/users" className="text-sm text-gray-400 hover:text-white transition">
                Användare
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          {session?.user && (
            <>
              <span className="text-gray-500 text-xs">
                {session.user.name} · {roleLabel(session.user.role)}
              </span>
              {session?.user?.role === "PARTNER" && (
                <div className="flex items-center gap-1">
                  {LANGS.map(l => (
                    <button
                      key={l}
                      onClick={() => handleLangChange(l)}
                      title={l.toUpperCase()}
                      className="rounded px-1 py-0.5 text-base transition"
                      style={{ opacity: currentLang === l ? 1 : 0.4, background: currentLang === l ? "rgba(255,255,255,0.1)" : "transparent" }}
                    >
                      {LANG_FLAGS[l]}
                    </button>
                  ))}
                </div>
              )}
              <Link
                href="/account/password"
                className="text-gray-400 hover:text-white transition text-xs"
              >
                Byt lösenord
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-white transition"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
              >
                Logga ut
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function roleLabel(role: string) {
  switch (role) {
    case "ADMIN": return "Förvaltare";
    case "OWNER": return "Ägare";
    case "PARTNER": return "Partner";
    case "CARETAKER": return "Fastighetsskötare";
    case "CLEANER": return "Städerska";
    default: return role;
  }
}
