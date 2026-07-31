import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendCaretakerReminder, sendRemainderPaymentEmail } from "@/lib/email";
import { createRemainderSession } from "@/lib/stripe";
import { BookingStatus } from "@prisma/client";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  // ── Fastighetsskötare-påminnelse (imorgon) ──────────────────────────────────
  const tomorrowCheckins = await prisma.booking.findMany({
    where: { status: BookingStatus.CONFIRMED, startDate: { gte: tomorrow, lt: dayAfter } },
    include: { property: { select: { name: true } } },
    orderBy: { property: { sortOrder: "asc" } },
  });

  if (tomorrowCheckins.length > 0) {
    await sendCaretakerReminder(
      tomorrowCheckins.map((b) => ({
        propertyName: b.property.name,
        startDate: b.startDate.toISOString(),
        endDate: b.endDate.toISOString(),
        guestName: b.guestName,
        numberOfPersons: b.numberOfPersons,
        boats: { boat6hp: b.boat6hp, boat99hp: b.boat99hp, boat20hp: b.boat20hp, boat25hp: b.boat25hp },
        nights: Math.round((b.endDate.getTime() - b.startDate.getTime()) / 86400000),
        cleaning: b.cleaning,
        bedLinen: b.bedLinen,
        notes: b.notes,
      }))
    );
  }

  // ── Slutbetalningspåminnelse (om 14 dagar) ──────────────────────────────────
  const in14 = new Date();
  in14.setDate(in14.getDate() + 14);
  in14.setHours(0, 0, 0, 0);
  const in15 = new Date(in14);
  in15.setDate(in15.getDate() + 1);

  // Partnern (den som bokade) ska betala resterande 80%
  const paymentReminders = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      startDate: { gte: in14, lt: in15 },
      totalPrice: { not: null, gt: 0 },
      depositPaid: true,
      remainderPaid: false,
      userId: { not: null },
    },
    include: {
      property: { select: { name: true } },
      user: { select: { email: true, name: true } },
    },
  });

  let reminders = 0;
  for (const b of paymentReminders) {
    if (!b.user?.email) continue;
    try {
      const url = await createRemainderSession({
        bookingId: b.id,
        guestEmail: b.user.email,
        guestName: b.user.name ?? "Partner",
        propertyName: b.property.name,
        startDate: b.startDate,
        totalPriceSEK: b.totalPrice!,
      });
      if (url) {
        await sendRemainderPaymentEmail({
          guestEmail: b.user.email,
          guestName: b.user.name ?? "Partner",
          propertyName: b.property.name,
          startDate: b.startDate.toISOString(),
          totalPrice: b.totalPrice!,
          paymentUrl: url,
        });
        reminders++;
      }
    } catch {
      // fortsätt med nästa bokning om en misslyckas
    }
  }

  return NextResponse.json({
    caretakerReminders: tomorrowCheckins.length,
    paymentReminders: reminders,
  });
}
