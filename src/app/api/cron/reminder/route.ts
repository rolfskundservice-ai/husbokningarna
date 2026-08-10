import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendCaretakerReminder, sendRemainderPaymentEmail } from "@/lib/email";
import { createRemainderSession } from "@/lib/stripe";
import { sendSmsToMany } from "@/lib/sms";
import { BookingStatus } from "@prisma/client";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  function dayRange(daysFromNow: number): { gte: Date; lt: Date } {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    return { gte: d, lt: next };
  }

  function fmtDate(iso: string) {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }

  // Hämta telefonnummer till fastighetsskötare och städerskor
  const [caretakers, cleaners] = await Promise.all([
    prisma.user.findMany({ where: { role: "CARETAKER", phone: { not: null } }, select: { phone: true } }),
    prisma.user.findMany({ where: { role: "CLEANER",   phone: { not: null } }, select: { phone: true } }),
  ]);
  const caretakerPhones = caretakers.map(u => u.phone!);
  const cleanerPhones   = cleaners.map(u => u.phone!);

  // ── Fastighetsskötare: imorgon (email + SMS) ────────────────────────────────
  const tomorrowCheckins = await prisma.booking.findMany({
    where: { status: BookingStatus.CONFIRMED, startDate: dayRange(1) },
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

    if (caretakerPhones.length > 0) {
      const lines = tomorrowCheckins.map(b =>
        `${b.property.name}: incheckning imorgon ${fmtDate(b.startDate.toISOString())}${b.guestName ? ` (${b.guestName})` : ""}`
      ).join("\n");
      await sendSmsToMany(caretakerPhones, `Påminnelse incheckningar imorgon:\n${lines}`);
    }
  }

  // ── Fastighetsskötare: om 14 dagar (SMS) ───────────────────────────────────
  const in14Checkins = await prisma.booking.findMany({
    where: { status: BookingStatus.CONFIRMED, startDate: dayRange(14) },
    include: { property: { select: { name: true } } },
    orderBy: { property: { sortOrder: "asc" } },
  });

  if (in14Checkins.length > 0 && caretakerPhones.length > 0) {
    const lines = in14Checkins.map(b =>
      `${b.property.name}: incheckning ${fmtDate(b.startDate.toISOString())}${b.guestName ? ` (${b.guestName})` : ""}`
    ).join("\n");
    await sendSmsToMany(caretakerPhones, `Kommande incheckningar om 14 dagar:\n${lines}`);
  }

  // ── Städerska: dagen innan utcheckning med städning (SMS) ──────────────────
  const tomorrowCheckouts = await prisma.booking.findMany({
    where: { status: BookingStatus.CONFIRMED, cleaning: true, endDate: dayRange(1) },
    include: { property: { select: { name: true } } },
    orderBy: { property: { sortOrder: "asc" } },
  });

  if (tomorrowCheckouts.length > 0 && cleanerPhones.length > 0) {
    const lines = tomorrowCheckouts.map(b =>
      `${b.property.name}: städning imorgon ${fmtDate(b.endDate.toISOString())}`
    ).join("\n");
    await sendSmsToMany(cleanerPhones, `Påminnelse städning imorgon:\n${lines}`);
  }

  // ── Städerska: om 7 dagar utcheckning med städning (SMS) ───────────────────
  const in7Checkouts = await prisma.booking.findMany({
    where: { status: BookingStatus.CONFIRMED, cleaning: true, endDate: dayRange(7) },
    include: { property: { select: { name: true } } },
    orderBy: { property: { sortOrder: "asc" } },
  });

  if (in7Checkouts.length > 0 && cleanerPhones.length > 0) {
    const lines = in7Checkouts.map(b =>
      `${b.property.name}: städning om 7 dagar ${fmtDate(b.endDate.toISOString())}`
    ).join("\n");
    await sendSmsToMany(cleanerPhones, `Kommande städningar om 7 dagar:\n${lines}`);
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
    caretakerEmailReminders: tomorrowCheckins.length,
    caretakerSms14days: in14Checkins.length,
    cleanerSms7days: in7Checkouts.length,
    cleanerSmsTomorrow: tomorrowCheckouts.length,
    paymentReminders: reminders,
  });
}
