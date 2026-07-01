import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { BookingSource, BookingStatus } from "@prisma/client";
import { sendGuestConfirmation, sendOwnerNotification } from "@/lib/email";
import crypto from "crypto";
import { totalBoats, assignBoatNumbers, parseBoatNumbers } from "@/lib/boats";

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
      guestEmail: b.guestEmail,
      notes: b.notes,
      numberOfPersons: b.numberOfPersons,
      boat6hp: b.boat6hp,
      boat99hp: b.boat99hp,
      boat20hp: b.boat20hp,
      boat25hp: b.boat25hp,
      numberOfBoats: totalBoats(b),
      cleaning: b.cleaning,
      bedLinen: b.bedLinen,
      source: b.source,
      status: b.status,
    }))
  );
}

const boatSchema = z.object({
  boat6hp:  z.number().int().min(0).max(2).optional().default(0),
  boat99hp: z.number().int().min(0).max(2).optional().default(0),
  boat20hp: z.number().int().min(0).max(2).optional().default(0),
  boat25hp: z.number().int().min(0).max(1).optional().default(0),
});

const createBookingSchema = z.object({
  propertyId: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  guestName: z.string().optional(),
  guestEmail: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
  numberOfPersons: z.number().int().min(1).optional(),
  cleaning: z.boolean().optional(),
  bedLinen: z.boolean().optional(),
}).merge(boatSchema);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  const body = await req.json();
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { propertyId, startDate, endDate, guestName, guestEmail, notes,
    numberOfPersons, cleaning, bedLinen,
    boat6hp, boat99hp, boat20hp, boat25hp } = parsed.data;

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

  // Kolla att property inte är dubbelbokad
  const overlapping = await prisma.booking.findFirst({
    where: {
      propertyId,
      status: BookingStatus.CONFIRMED,
      startDate: { lt: end },
      endDate: { gt: start },
    },
  });
  if (overlapping) {
    return NextResponse.json({ error: "Perioden krockar med en befintlig bokning" }, { status: 409 });
  }

  // Kolla båttillgänglighet globalt och samla tagna båtnummer
  const overlapBookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      startDate: { lt: end },
      endDate: { gt: start },
    },
    select: { boat6hp: true, boat99hp: true, boat20hp: true, boat25hp: true, boatNumbers: true },
  });

  if (boat6hp || boat99hp || boat20hp || boat25hp) {
    const used6hp  = overlapBookings.reduce((s, b) => s + b.boat6hp,  0);
    const used99hp = overlapBookings.reduce((s, b) => s + b.boat99hp, 0);
    const used20hp = overlapBookings.reduce((s, b) => s + b.boat20hp, 0);
    const used25hp = overlapBookings.reduce((s, b) => s + b.boat25hp, 0);

    if (boat6hp  > 2 - used6hp)  return NextResponse.json({ error: `Bara ${2 - used6hp} st 6 hk-båtar tillgängliga` },  { status: 409 });
    if (boat99hp > 2 - used99hp) return NextResponse.json({ error: `Bara ${2 - used99hp} st 9,9 hk-båtar tillgängliga` }, { status: 409 });
    if (boat20hp > 2 - used20hp) return NextResponse.json({ error: `Bara ${2 - used20hp} st 20 hk-båtar tillgängliga` }, { status: 409 });
    if (boat25hp > 1 - used25hp) return NextResponse.json({ error: `Bara ${1 - used25hp} st 25 hk-båtar tillgängliga` }, { status: 409 });
  }

  // Tilldela specifika båtnummer
  const takenNumbers = overlapBookings.flatMap(b => parseBoatNumbers(b.boatNumbers));
  const assignedNumbers = assignBoatNumbers({ boat6hp, boat99hp, boat20hp, boat25hp }, takenNumbers);
  const boatNumbers = assignedNumbers.join(",");

  const addonToken = crypto.randomBytes(32).toString("hex");

  const booking = await prisma.booking.create({
    data: {
      propertyId,
      userId: session.user.id,
      startDate: start,
      endDate: end,
      guestName: guestName || null,
      guestEmail: guestEmail || null,
      notes: notes || null,
      numberOfPersons: numberOfPersons ?? null,
      boat6hp, boat99hp, boat20hp, boat25hp,
      boatNumbers,
      cleaning: cleaning ?? false,
      bedLinen: bedLinen ?? false,
      addonToken,
      source: BookingSource.INTERNAL,
      status: BookingStatus.CONFIRMED,
    },
  });

  const boats = { boat6hp, boat99hp, boat20hp, boat25hp };
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);

  prisma.property.findUnique({ where: { id: propertyId }, select: { name: true } }).then((p) => {
    if (!p) return;

    sendOwnerNotification({
      propertyName: p.name,
      startDate: booking.startDate.toISOString(),
      endDate: booking.endDate.toISOString(),
      guestName: guestName ?? null,
      guestEmail: guestEmail ?? null,
      numberOfPersons: numberOfPersons ?? null,
      boats,
      boatNumbers: assignedNumbers,
      nights,
      cleaning: cleaning ?? false,
      bedLinen: bedLinen ?? false,
      notes: notes ?? null,
      bookedBy: session.user.name,
    }).catch(() => {});

    if (guestEmail) {
      sendGuestConfirmation({
        guestEmail,
        guestName: guestName || "Gäst",
        propertyName: p.name,
        startDate: booking.startDate.toISOString(),
        endDate: booking.endDate.toISOString(),
        numberOfPersons: numberOfPersons ?? null,
        boats,
        boatNumbers: assignedNumbers,
        nights,
        cleaning: cleaning ?? false,
        bedLinen: bedLinen ?? false,
        notes: notes ?? null,
        bookingId: booking.id,
        addonToken,
      }).catch(() => {});
    }
  });

  return NextResponse.json(booking, { status: 201 });
}
