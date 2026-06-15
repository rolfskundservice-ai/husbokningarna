"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="text-lg font-semibold text-gray-900">
          🏡 Stugbokning
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {session?.user && (
            <>
              <span className="text-gray-500">
                {session.user.name} <span className="text-gray-400">({roleLabel(session.user.role)})</span>
              </span>
              {session.user.role === "ADMIN" && (
                <Link href="/admin/properties" className="font-medium text-brand-600 hover:underline">
                  Hantera stugor
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
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
    case "ADMIN":
      return "Förvaltare";
    case "OWNER":
      return "Ägare";
    case "PARTNER":
      return "Partner";
    default:
      return role;
  }
}
