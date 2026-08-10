import { NextResponse } from "next/server";
import { sendCaretakerReminder } from "@/lib/email";

export async function GET() {
  await sendCaretakerReminder([
    {
      propertyName: "Teststugan",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      guestName: "Testgäst",
      numberOfPersons: 4,
      boats: { boat6hp: 1, boat99hp: 0, boat20hp: 0, boat25hp: 0 },
      nights: 6,
      cleaning: true,
      bedLinen: true,
      notes: "Testanteckning",
    },
  ]);

  return NextResponse.json({ ok: true });
}
