import { NextResponse } from "next/server";
import { sendSms } from "@/lib/sms";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to");

  if (!to) {
    return NextResponse.json({ error: "Ange ?to=07XXXXXXXX" }, { status: 400 });
  }

  try {
    const raw = await sendSms(to, `Kommande incheckningar om 14 dagar:\nTeststugan: incheckning 24/8 (Testgäst)`);
    return NextResponse.json({ phone: to, ok: true, elksResponse: raw });
  } catch (err) {
    return NextResponse.json({ phone: to, ok: false, error: String(err) });
  }
}
