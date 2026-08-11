import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  const { language } = await req.json();
  if (!["sv", "en", "pl"].includes(language)) {
    return NextResponse.json({ error: "Ogiltigt språk" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { language },
  });

  return NextResponse.json({ ok: true });
}
