import { NextResponse } from "next/server";
import { sendSms } from "@/lib/sms";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to");

  const hasUser = !!process.env.ELKS_API_USER;
  const hasPass = !!process.env.ELKS_API_PASSWORD;

  if (!hasUser || !hasPass) {
    return NextResponse.json({
      error: "Miljövariabler saknas",
      ELKS_API_USER: hasUser ? "finns" : "SAKNAS",
      ELKS_API_PASSWORD: hasPass ? "finns" : "SAKNAS",
    }, { status: 500 });
  }

  if (!to) {
    return NextResponse.json({ credentialsOk: true, error: "Ange ?to=07XXXXXXXX" }, { status: 400 });
  }

  try {
    const raw = await sendSms(to, `Testmeddelande från Husbokningarna`);
    return NextResponse.json({ phone: to, ok: true, elksResponse: raw });
  } catch (err) {
    return NextResponse.json({ phone: to, ok: false, error: String(err) });
  }
}
