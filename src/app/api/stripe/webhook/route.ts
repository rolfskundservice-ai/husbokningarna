import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe ej konfigurerat" }, { status: 500 });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Saknar signatur eller webhook-hemlighet" }, { status: 400 });
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: `Webhook-fel: ${String(err)}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId;
    const type = session.metadata?.type;

    if (!bookingId) return NextResponse.json({ ok: true });

    if (type === "deposit") {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { depositPaid: true },
      });
    } else if (type === "remainder") {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { remainderPaid: true },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
