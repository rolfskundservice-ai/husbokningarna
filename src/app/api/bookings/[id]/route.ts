import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BookingSource } from "@prisma/client";

// DELETE /api/bookings/:id  - avboka (endast egna bokningar, eller ADMIN/OWNER alla)
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) return NextResponse.json({ error: "Hittas inte" }, { status: 404 });

  if (booking.source === BookingSource.AIRBNB) {
    return NextResponse.json(
      { error: "Airbnb-bokningar kan inte tas bort härifrån - avbokas via Airbnb" },
      { status: 400 }
    );
  }

  const isOwnBooking = booking.userId === session.user.id;
  const isPrivileged = session.user.role === "ADMIN" || session.user.role === "OWNER";

  if (!isOwnBooking && !isPrivileged) {
    return NextResponse.json({ error: "Du kan bara ta bort egna bokningar" }, { status: 403 });
  }

  await prisma.booking.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
