import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { sendAddonConfirmation } from "@/lib/email";
import { assignBoatNumbers, parseBoatNumbers, formatBoatNumbers, boatPrice, BOAT_TYPES, BoatId } from "@/lib/boats";
import { BookingStatus } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe ej konfigurerat" }, { status: 500 });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Saknar signatur" }, { status: 400 });
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId;
    const type = session.metadata?.type;

    if (!bookingId) return NextResponse.json({ ok: true });

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { property: { select: { name: true } } },
    });
    if (!booking) return NextResponse.json({ ok: true });

    // ── Handpenning ─────────────────────────────────────────────────────────
    if (type === "deposit") {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { depositPaid: true },
      });
    }

    // ── Slutbetalning ────────────────────────────────────────────────────────
    else if (type === "remainder") {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { remainderPaid: true },
      });
    }

    // ── Addon-betalning ──────────────────────────────────────────────────────
    else if (type === "addon") {
      const addonType = session.metadata?.addonType;

      if (addonType === "boat") {
        const [c6, c99, c20, c25] = (session.metadata?.boatCounts ?? "0,0,0,0")
          .split(",").map(Number);

        const newCounts = { boat6hp: c6, boat99hp: c99, boat20hp: c20, boat25hp: c25 };

        const overlap = await prisma.booking.findMany({
          where: {
            id: { not: bookingId },
            status: BookingStatus.CONFIRMED,
            startDate: { lt: booking.endDate },
            endDate: { gt: booking.startDate },
          },
          select: { boatNumbers: true },
        });

        const takenNumbers = overlap.flatMap(b => parseBoatNumbers(b.boatNumbers ?? ""));
        const assignedNumbers = assignBoatNumbers(newCounts, takenNumbers);

        await prisma.booking.update({
          where: { id: bookingId },
          data: { ...newCounts, boatNumbers: assignedNumbers.join(",") },
        });

        if (booking.guestEmail) {
          const nights = Math.round(
            (booking.endDate.getTime() - booking.startDate.getTime()) / 86400000
          );
          const lines = BOAT_TYPES
            .filter(t => (newCounts[t.id as BoatId] ?? 0) > 0)
            .map(t => `${newCounts[t.id as BoatId]}× ${t.label} (${boatPrice(t.weekPrice, nights).toLocaleString("sv-SE")} kr)`)
            .join(", ");

          await sendAddonConfirmation({
            guestEmail: booking.guestEmail,
            guestName: booking.guestName ?? "Gäst",
            propertyName: booking.property.name,
            startDate: booking.startDate.toISOString(),
            what: formatBoatNumbers(assignedNumbers),
            detail: lines,
          }).catch(() => {});
        }
      }

      else if (addonType === "cleaning") {
        await prisma.booking.update({ where: { id: bookingId }, data: { cleaning: true } });

        if (booking.guestEmail) {
          await sendAddonConfirmation({
            guestEmail: booking.guestEmail,
            guestName: booking.guestName ?? "Gäst",
            propertyName: booking.property.name,
            startDate: booking.startDate.toISOString(),
            what: "Städning",
            detail: "2 200 kr — betalt via Stripe",
          }).catch(() => {});
        }
      }

      else if (addonType === "linen") {
        await prisma.booking.update({ where: { id: bookingId }, data: { bedLinen: true } });

        if (booking.guestEmail) {
          await sendAddonConfirmation({
            guestEmail: booking.guestEmail,
            guestName: booking.guestName ?? "Gäst",
            propertyName: booking.property.name,
            startDate: booking.startDate.toISOString(),
            what: "Lakan",
            detail: "220 kr — betalt via Stripe",
          }).catch(() => {});
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
