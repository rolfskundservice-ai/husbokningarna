import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendSms } from "@/lib/sms";

export async function GET() {
  const caretakers = await prisma.user.findMany({
    where: { role: "CARETAKER", phone: { not: null } },
    select: { name: true, phone: true },
  });

  if (caretakers.length === 0) {
    return NextResponse.json({ error: "Inga fastighetsskötare med telefonnummer" }, { status: 404 });
  }

  const phones = caretakers.map(u => u.phone!);
  const results = [];
  for (const u of caretakers) {
    try {
      const raw = await sendSms(u.phone!, `Kommande incheckningar om 14 dagar:\nTeststugan: incheckning 24/8 (Testgäst)`);
      results.push({ name: u.name, phone: u.phone, ok: true, elksResponse: raw });
    } catch (err) {
      results.push({ name: u.name, phone: u.phone, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({ sent: results });
}
