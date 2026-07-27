import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Resend } from "resend";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Ej behörig" }, { status: 403 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";
  const to = process.env.OWNER_EMAIL;

  const config = {
    RESEND_API_KEY: apiKey ? "✓ finns" : "(saknas)",
    RESEND_FROM: from,
    OWNER_EMAIL: to ?? "(saknas)",
  };

  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY saknas", config }, { status: 500 });
  }
  if (!to) {
    return NextResponse.json({ error: "OWNER_EMAIL saknas", config }, { status: 500 });
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to,
      subject: "Testmail Resend ✓",
      html: "<p>Om du ser detta fungerar Resend korrekt!</p>",
    });

    if (result.error) {
      return NextResponse.json({ error: result.error.message, config }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: result.data?.id, config });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, config }, { status: 500 });
  }
}
