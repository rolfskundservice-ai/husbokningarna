import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BookingStatus } from "@prisma/client";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
  if (session.user.role === "PARTNER") {
    return NextResponse.json({ error: "Ej behörig" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      ...(from && to
        ? { AND: [{ startDate: { gte: new Date(from) } }, { startDate: { lte: new Date(to) } }] }
        : {}),
    },
    include: {
      property: { select: { name: true } },
      user: { select: { name: true } },
    },
    orderBy: [{ propertyId: "asc" }, { startDate: "asc" }],
  });

  const header = ["Stuga", "Incheckning", "Utcheckning", "Gäst", "Bokad av", "Källa", "Anteckning"];
  const rows = bookings.map((b) => [
    b.property.name,
    b.startDate.toISOString().slice(0, 10),
    b.endDate.toISOString().slice(0, 10),
    b.guestName ?? "",
    b.user?.name ?? "",
    b.source,
    b.notes ?? "",
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bokningar-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
