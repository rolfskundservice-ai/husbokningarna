import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWeeksInRange } from "@/lib/weeks";
import { BookingStatus } from "@prisma/client";

// GET /api/availability/:propertyId?from=YYYY-MM-DD&weeks=12
// Returnerar en lista av veckor med status: AVAILABLE | BOOKED_INTERNAL | BOOKED_AIRBNB
export async function GET(req: Request, { params }: { params: { propertyId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  const { propertyId } = params;

  if (session.user.role === "PARTNER") {
    const access = await prisma.propertyAccess.findUnique({
      where: { userId_propertyId: { userId: session.user.id, propertyId } },
    });
    if (!access) return NextResponse.json({ error: "Ingen åtkomst" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const weeksParam = searchParams.get("weeks");

  const from = fromParam ? new Date(fromParam) : new Date();
  const weeksCount = weeksParam ? Math.min(Number(weeksParam), 52) : 12;

  const weeks = getWeeksInRange(from, weeksCount);
  const rangeStart = weeks[0].startDate;
  const rangeEnd = weeks[weeks.length - 1].endDate;

  const bookings = await prisma.booking.findMany({
    where: {
      propertyId,
      status: BookingStatus.CONFIRMED,
      startDate: { lt: rangeEnd },
      endDate: { gt: rangeStart },
    },
    include: { user: { select: { name: true } } },
  });

  const result = weeks.map((week) => {
    const overlapping = bookings.filter(
      (b) => b.startDate < week.endDate && b.endDate > week.startDate
    );

    let status: "AVAILABLE" | "BOOKED_INTERNAL" | "BOOKED_AIRBNB" | "PARTIAL" = "AVAILABLE";
    if (overlapping.length > 0) {
      const fullyCovers = overlapping.some(
        (b) => b.startDate <= week.startDate && b.endDate >= week.endDate
      );
      if (fullyCovers) {
        status = overlapping.some((b) => b.source === "AIRBNB") ? "BOOKED_AIRBNB" : "BOOKED_INTERNAL";
      } else {
        status = "PARTIAL";
      }
    }

    return {
      weekNumber: week.weekNumber,
      year: week.year,
      startDate: week.startDate.toISOString(),
      endDate: week.endDate.toISOString(),
      label: week.label,
      status,
      bookings: overlapping.map((b) => ({
        id: b.id,
        startDate: b.startDate.toISOString(),
        endDate: b.endDate.toISOString(),
        guestName: b.guestName,
        source: b.source,
        userName: b.user?.name ?? null,
      })),
    };
  });

  return NextResponse.json(result);
}
