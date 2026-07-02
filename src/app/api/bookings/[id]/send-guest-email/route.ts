import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendGuestConfirmation } from "@/lib/email";
import { parseBoatNumbers } from "@/lib/boats";
import crypto from "crypto";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "OWNER") {
    return NextResponse.json({ error: "Otillräcklig behörighet" }, { status: 403 });
  }

  const { email } = await req.json();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Ogiltig e-postadress" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { property: { select: { name: true } } },
  });
  if (!booking) return NextResponse.json({ error: "Hittas inte" }, { status: 404 });

  // Generera addonToken om det saknas
  const addonToken = booking.addonToken ?? crypto.randomBytes(32).toString("hex");

  await prisma.booking.update({
    where: { id: params.id },
    data: { guestEmail: email, addonToken },
  });

  const nights = Math.round(
    (booking.endDate.getTime() - booking.startDate.getTime()) / 86400000
  );

  await sendGuestConfirmation({
    guestEmail: email,
    guestName: booking.guestName ?? "Gäst",
    propertyName: booking.property.name,
    startDate: booking.startDate.toISOString(),
    endDate: booking.endDate.toISOString(),
    numberOfPersons: booking.numberOfPersons,
    boats: {
      boat6hp: booking.boat6hp,
      boat99hp: booking.boat99hp,
      boat20hp: booking.boat20hp,
      boat25hp: booking.boat25hp,
    },
    boatNumbers: parseBoatNumbers(booking.boatNumbers),
    nights,
    cleaning: booking.cleaning,
    bedLinen: booking.bedLinen,
    notes: booking.notes,
    bookingId: booking.id,
    addonToken,
  });

  return NextResponse.json({ ok: true });
}
