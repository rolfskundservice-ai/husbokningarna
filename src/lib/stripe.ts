import Stripe from "stripe";

export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-07-29.dahlia" });
}

export async function createDepositSession(params: {
  bookingId: string;
  guestEmail: string;
  guestName: string;
  propertyName: string;
  startDate: Date;
  totalPriceSEK: number;
}): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const depositAmount = Math.round(params.totalPriceSEK * 0.20);
  const base = process.env.NEXTAUTH_URL ?? "https://husbokningarnas.vercel.app";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: params.guestEmail,
    line_items: [
      {
        price_data: {
          currency: "sek",
          unit_amount: depositAmount * 100, // Stripe använder ören
          product_data: {
            name: `Handpenning 20% — ${params.propertyName}`,
            description: `Incheckning ${params.startDate.toLocaleDateString("sv-SE")}. Resterande 80% faktureras 14 dagar innan.`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: { bookingId: params.bookingId, type: "deposit" },
    success_url: `${base}/booking-paid?session_id={CHECKOUT_SESSION_ID}&type=deposit`,
    cancel_url: `${base}/`,
    payment_intent_data: {
      description: `Handpenning ${params.propertyName} — ${params.guestName}`,
    },
  });

  return session.url;
}

export async function createRemainderSession(params: {
  bookingId: string;
  guestEmail: string;
  guestName: string;
  propertyName: string;
  startDate: Date;
  totalPriceSEK: number;
}): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const remainderAmount = Math.round(params.totalPriceSEK * 0.80);
  const base = process.env.NEXTAUTH_URL ?? "https://husbokningarnas.vercel.app";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: params.guestEmail,
    line_items: [
      {
        price_data: {
          currency: "sek",
          unit_amount: remainderAmount * 100,
          product_data: {
            name: `Slutbetalning 80% — ${params.propertyName}`,
            description: `Incheckning ${params.startDate.toLocaleDateString("sv-SE")}.`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: { bookingId: params.bookingId, type: "remainder" },
    success_url: `${base}/booking-paid?session_id={CHECKOUT_SESSION_ID}&type=remainder`,
    cancel_url: `${base}/`,
    payment_intent_data: {
      description: `Slutbetalning ${params.propertyName} — ${params.guestName}`,
    },
  });

  return session.url;
}
