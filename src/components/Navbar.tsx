"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav style={{ background: "#0f0f0f", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-base font-semibold text-white">
            🏡 Stugbokning
          </Link>
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition">
            Kalender
          </Link>
          <Link href="/overview" className="text-sm text-gray-400 hover:text-white transition">
            Översikt
          </Link>
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
