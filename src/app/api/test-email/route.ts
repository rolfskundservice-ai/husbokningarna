import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Resend } from "resend";
import { sendGuestConfirmation } from "@/lib/email";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Ej behörig" }, { status: 403 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "(saknas)";
  const ownerEmail = process.env.OWNER_EMAIL;

  const config = {
    RESEND_API_KEY: apiKey ? "✓ finns" : "(saknas)",
    RESEND_FROM: from,
    OWNER_EMAIL: ownerEmail ?? "(saknas)",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "(saknas)",
  };

  if (!apiKey) return NextResponse.json({ error: "RESEND_API_KEY saknas", config }, { status: 500 });
  if (!ownerEmail) return NextResponse.json({ error: "OWNER_EMAIL saknas", config }, { status: 500 });

  // Steg 1: enkelt Resend-ping
  try {
    const resend = new Resend(apiKey);
    const ping = await resend.emails.send({
      from,
      to: ownerEmail,
      subject: "Resend ping ✓",
      html: "<p>Resend fungerar.</p>",
    });
    if (ping.error) {
      return NextResponse.json({ step: "ping", error: ping.error, config }, { status: 500 });
    }
  } catch (err: unknown) {
    return NextResponse.json({ step: "ping", error: String(err), config }, { status: 500 });
  }

  // Steg 2: testa sendGuestConfirmation
  try {
    await sendGuestConfirmation({
      guestEmail: ownerEmail,
      guestName: "Testgäst",
      propertyName: "Teststuga",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      numberOfPersons: 2,
      boats: { boat6hp: 0, boat99hp: 0, boat20hp: 0, boat25hp: 0 },
      boatNumbers: [],
      nights: 7,
      cleaning: false,
      bedLinen: false,
      notes: null,
      bookingId: "test-id",
      addonToken: "test-token-123",
    });
  } catch (err: unknown) {
    return NextResponse.json({ step: "sendGuestConfirmation", error: String(err), config }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Båda stegen lyckades — kolla din inkorg", config });
}
