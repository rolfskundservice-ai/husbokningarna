import { prisma } from "@/lib/db";
import { BookingStatus } from "@prisma/client";

function icalDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
}

function escape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(_req: Request, { params }: { params: { propertyId: string } }) {
  const property = await prisma.property.findUnique({
    where: { id: params.propertyId },
    select: { id: true, name: true },
  });

  if (!property) {
    return new Response("Not found", { status: 404 });
  }

  const bookings = await prisma.booking.findMany({
    where: {
      propertyId: params.propertyId,
      status: BookingStatus.CONFIRMED,
    },
    orderBy: { startDate: "asc" },
  });

  const now = icalDate(new Date());
  const host = process.env.NEXTAUTH_URL ?? "https://husbokningarnas.vercel.app";

  const events = bookings.map(b => {
    const summary = b.guestName ? escape(b.guestName) : "Bokad";
    return [
      "BEGIN:VEVENT",
      `UID:${b.id}@husbokningarna`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${b.startDate.toISOString().slice(0,10).replace(/-/g,"")}`,
      `DTEND;VALUE=DATE:${b.endDate.toISOString().slice(0,10).replace(/-/g,"")}`,
      `SUMMARY:${summary}`,
      `STATUS:CONFIRMED`,
      "END:VEVENT",
    ].join("\r\n");
  }).join("\r\n");

  const cal = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Husbokningarna//${escape(property.name)}//SV`,
    `X-WR-CALNAME:${escape(property.name)}`,
    "X-WR-TIMEZONE:Europe/Stockholm",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(cal, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${property.id}.ics"`,
      "Cache-Control": "no-cache, no-store",
    },
  });
}
