import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendCaretakerReminder } from "@/lib/email";
import { BookingStatus } from "@prisma/client";

export async function GET(req: Request) {
  // Verifiera Vercel cron-secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const checkins = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      startDate: { gte: tomorrow, lt: dayAfter },
    },
    include: { property: { select: { name: true } } },
    orderBy: { property: { sortOrder: "asc" } },
  });

  if (checkins.length === 0) {
    return NextResponse.json({ message: "Inga incheckningar imorgon" });
  }

  await sendCaretakerReminder(
    checkins.map((b) => ({
      propertyName: b.property.name,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
      guestName: b.guestName,
      numberOfPersons: b.numberOfPersons,
      numberOfBoats: b.numberOfBoats,
      cleaning: b.cleaning,
      bedLinen: b.bedLinen,
      notes: b.notes,
    }))
  );

  return NextResponse.json({ sent: checkins.length });
}
