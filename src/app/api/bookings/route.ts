import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { BookingSource, BookingStatus } from "@prisma/client";
import { sendBookingNotification } from "@/lib/email";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (session.user.role === "PARTNER" && propertyId) {
    const access = await prisma.propertyAccess.findUnique({
      where: { userId_propertyId: { userId: session.user.id, propertyId } },
    });
    if (!access) return NextResponse.json({ error: "Ingen åtkomst" }, { status: 403 });
  }

  const where: Record<string, unknown> = { status: BookingStatus.CONFIRMED };
  if (propertyId) where.propertyId = propertyId;
  if (from && to) {
    where.AND = [{ startDate: { lt: new Date(to) } }, { endDate: { gt: new Date(from) } }];
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: { user: { select: { name: true } } },
    orderBy: { startDate: "asc" },
  });

  return NextResponse.json(
    bookings.map((b) => ({
      id: b.id,
      propertyId: b.propertyId,
      userId: b.userId,
      userName: b.user?.name ?? null,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
      guestName: b.guestName,
      notes: b.notes,
      numberOfPersons: b.numberOfPersons,
      numberOfBoats: b.numberOfBoats,
      source: b.source,
      status: b.status,
    }))
  );
}

const createBookingSchema = z.object({
  propertyId: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  guestName: z.string().optional(),
  notes: z.string().optional(),
  numberOfPersons: z.number().int().min(1).optional(),
  numberOfBoats: z.number().int().min(0).optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  const body = await req.json();
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { propertyId, startDate, endDate, guestName, notes, numberOfPersons, numberOfBoats } = parsed.data;

  if (session.user.role === "PARTNER") {
    const access = await prisma.propertyAccess.findUnique({
      where: { userId_propertyId: { userId: session.user.id, propertyId } },
    });
    if (!access) return NextResponse.json({ error: "Ingen åtkomst till denna stuga" }, { status: 403 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end <= start) {
    return NextResponse.json({ error: "Slutdatum måste vara efter startdatum" }, { status: 400 });
  }

  const overlapping = await prisma.booking.findFirst({
    where: {
      propertyId,
      status: BookingStatus.CONFIRMED,
      startDate: { lt: end },
      endDate: { gt: start },
    },
  });

  if (overlapping) {
    return NextResponse.json(
      { error: "Perioden krockar med en befintlig bokning" },
      { status: 409 }
    );
  }

  const booking = await prisma.booking.create({
    data: {
      propertyId,
      userId: session.user.id,
      startDate: start,
      endDate: end,
      guestName: guestName || null,
      notes: notes || null,
      numberOfPersons: numberOfPersons ?? null,
      numberOfBoats: numberOfBoats ?? null,
      source: BookingSource.INTERNAL,
      status: BookingStatus.CONFIRMED,
    },
  });

  prisma.property.findUnique({ where: { id: propertyId }, select: { name: true } }).then((p) => {
    if (!p) return;
    sendBookingNotification({
      propertyName: p.name,
      weekLabel: `${startDate} – ${endDate}`,
      guestName: guestName ?? null,
      bookedBy: session.user.name,
      notes: notes ?? null,
    }).catch(() => {});
  });

  return NextResponse.json(booking, { status: 201 });
}
