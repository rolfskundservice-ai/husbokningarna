import { NextResponse } from "next/server";
import { sendSms } from "@/lib/sms";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to") ?? "0761124197";

  const msg14 = `Kommande incheckningar om 14 dagar:\nSjöstugan: incheckning 24/8 (Kowalski)\nSkogsstugan: incheckning 24/8 (Nowak)`;
  const msgTomorrow = `Påminnelse incheckningar imorgon:\nSjöstugan: incheckning 11/8 (Kowalski)`;

  await sendSms(to, msg14);
  await sendSms(to, msgTomorrow);

  return NextResponse.json({ ok: true, sentTo: to });
}
