import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncAllAirbnbCalendars, syncAirbnbCalendar } from "@/lib/ical";

// GET /api/sync/airbnb
// Anropas av Vercel Cron (skickar Authorization: Bearer $CRON_SECRET).
// Synkar alla properties som har en Airbnb-iCal-URL.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await syncAllAirbnbCalendars();
  return NextResponse.json(results);
}

// POST /api/sync/airbnb
// Body (valfri): { propertyId?: string }
// Om propertyId saknas synkas alla properties.
// Anropas av: (a) en knapp i admin-UI, (b) en cron job (t.ex. Vercel Cron var 30 min)
//
// För cron: skydda med en secret-header, se CRON_SECRET nedan.
export async function POST(req: Request) {
  const cronSecret = req.headers.get("x-cron-secret");
  const isCron = cronSecret && cronSecret === process.env.CRON_SECRET;

  if (!isCron) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "OWNER")) {
      return NextResponse.json({ error: "Endast admin/ägare kan synka" }, { status: 403 });
    }
  }

  let body: { propertyId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // tomt body är ok
  }

  if (body.propertyId) {
    const result = await syncAirbnbCalendar(body.propertyId);
    return NextResponse.json({ [body.propertyId]: result });
  }

  const results = await syncAllAirbnbCalendars();
  return NextResponse.json(results);
}
