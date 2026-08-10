import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendSms } from "@/lib/sms";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Ej behörig" }, { status: 403 });
  }

  const caretakers = await prisma.user.findMany({
    where: { role: "CARETAKER", phone: { not: null } },
    select: { name: true, phone: true },
  });

  if (caretakers.length === 0) {
    return NextResponse.json({ error: "Inga fastighetsskötare med telefonnummer hittades" }, { status: 404 });
  }

  const results = [];
  for (const u of caretakers) {
    try {
      await sendSms(u.phone!, `Testmeddelande från Husbokningarna — SMS-utskick fungerar! 🎉`);
      results.push({ name: u.name, phone: u.phone, ok: true });
    } catch (err) {
      results.push({ name: u.name, phone: u.phone, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({ sent: results });
}
