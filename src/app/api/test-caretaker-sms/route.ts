import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendSmsToMany } from "@/lib/sms";

export async function GET() {
  const caretakers = await prisma.user.findMany({
    where: { role: "CARETAKER", phone: { not: null } },
    select: { name: true, phone: true },
  });

  if (caretakers.length === 0) {
    return NextResponse.json({ error: "Inga fastighetsskötare med telefonnummer" }, { status: 404 });
  }

  const phones = caretakers.map(u => u.phone!);
  await sendSmsToMany(phones, `Kommande incheckningar om 14 dagar:\nTeststugan: incheckning 24/8 (Testgäst)`);

  return NextResponse.json({ sent: caretakers.map(u => ({ name: u.name, phone: u.phone, ok: true })) });
}
