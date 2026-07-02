import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BookingStatus } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  const role = session.user.role;
  if (role !== "CARETAKER" && role !== "CLEANER" && role !== "ADMIN" && role !== "OWNER") {
    return NextResponse.json({ error: "Ej behörig" }, { status: 403 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Visa incheckningar de kommande 14 dagarna + utcheckningar de kommande 14 dagarna
  const twoWeeksAhead = new Date(today);
  twoWeeksAhead.setDate(today.getDate() + 14);

  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      OR: [
        { startDate: { gte: today, lt: twoWeeksAhead } }, // incheckningar
        { endDate: { gt: today, lte: twoWeeksAhead } },   // utcheckningar
      ],
    },
    include: { property: { select: { name: true, color: true } } },
    orderBy: { startDate: "asc" },
  });

  return NextResponse.json(bookings.map(b => ({
    id: b.id,
    propertyName: b.property.name,
    propertyColor: b.property.color,
    startDate: b.startDate.toISOString(),
    endDate: b.endDate.toISOString(),
    guestName: b.guestName,
    numberOfPersons: b.numberOfPersons,
    boatNumbers: b.boatNumbers,
    cleaning: b.cleaning,
    bedLinen: b.bedLinen,
    notes: b.notes,
  })));
}
