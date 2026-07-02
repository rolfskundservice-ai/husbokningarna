import ical from "node-ical";
import { prisma } from "@/lib/db";
import { BookingSource, BookingStatus } from "@prisma/client";
import { sendAirbnbSyncNotification } from "@/lib/email";

/**
 * Parsar Airbnb-iCal DESCRIPTION-fältet för att extrahera antal gäster,
 * telefonnummer och reservationskod.
 */
function parseAirbnbDescription(desc: string | undefined): {
  numberOfPersons: number | null;
  phone: string | null;
  reservationCode: string | null;
} {
  if (!desc) return { numberOfPersons: null, phone: null, reservationCode: null };

  const text = desc.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");

  const guestMatch =
    text.match(/Number of Guests[:\s]+(\d+)/i) ??
    text.match(/Antal g[äa]ster[:\s]+(\d+)/i) ??
    text.match(/GUESTS[:\s]+(\d+)/i) ??
    text.match(/(\d+)\s+g[äa]ster/i);
  const numberOfPersons = guestMatch ? parseInt(guestMatch[1], 10) : null;

  const phoneMatch =
    text.match(/Phone[^:]*:\s*([+\d\s\-()]{6,})/i) ??
    text.match(/Telefon[^:]*:\s*([+\d\s\-()]{6,})/i);
  const phone = phoneMatch ? phoneMatch[1].trim() : null;

  const codeMatch =
    text.match(/reservations\/details\/([A-Z0-9]+)/i) ??
    text.match(/Booking Code[:\s]+([A-Z0-9]+)/i) ??
    text.match(/BOOKING CODE[:\s]+([A-Z0-9]+)/i);
  const reservationCode = codeMatch ? codeMatch[1] : null;

  return { numberOfPersons, phone, reservationCode };
}

export async function syncAirbnbCalendar(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property?.airbnbIcalUrl) {
    return { synced: 0, removed: 0, skipped: true };
  }

  const data = await ical.async.fromURL(property.airbnbIcalUrl);

  const incomingEvents: {
    externalId: string;
    start: Date;
    end: Date;
    summary?: string;
    description?: string;
  }[] = [];

  for (const key of Object.keys(data)) {
    const event = data[key];
    if (event.type !== "VEVENT") continue;
    if (!event.start || !event.end) continue;

    incomingEvents.push({
      externalId: event.uid || key,
      start: event.start as Date,
      end: event.end as Date,
      summary: event.summary as string | undefined,
      description: event.description as string | undefined,
    });
  }

  let synced = 0;

  for (const ev of incomingEvents) {
    const { numberOfPersons, phone, reservationCode } = parseAirbnbDescription(ev.description);

    const existing = await prisma.booking.findUnique({
      where: { propertyId_externalId: { propertyId, externalId: ev.externalId } },
      select: { id: true },
    });

    await prisma.booking.upsert({
      where: {
        propertyId_externalId: {
          propertyId,
          externalId: ev.externalId,
        },
      },
      update: {
        startDate: ev.start,
        endDate: ev.end,
        guestName: ev.summary ?? "Airbnb-gäst",
        status: BookingStatus.CONFIRMED,
        ...(numberOfPersons !== null && { numberOfPersons }),
        ...(reservationCode !== null && { notes: `Airbnb: ${reservationCode}` }),
      },
      create: {
        propertyId,
        externalId: ev.externalId,
        startDate: ev.start,
        endDate: ev.end,
        guestName: ev.summary ?? "Airbnb-gäst",
        source: BookingSource.AIRBNB,
        status: BookingStatus.CONFIRMED,
        ...(numberOfPersons !== null && { numberOfPersons }),
        ...(reservationCode !== null && { notes: `Airbnb: ${reservationCode}` }),
      },
    });

    if (!existing) {
      try {
        await sendAirbnbSyncNotification({
          propertyName: property.name,
          startDate: ev.start.toISOString(),
          endDate: ev.end.toISOString(),
          guestName: ev.summary ?? "Airbnb-gäst",
          numberOfPersons,
          phone,
          reservationCode,
        });
      } catch {
        // Email-fel ska inte stoppa synken
      }
    }

    synced++;
  }

  const incomingIds = incomingEvents.map((e) => e.externalId);
  const removed = await prisma.booking.deleteMany({
    where: {
      propertyId,
      source: BookingSource.AIRBNB,
      externalId: { notIn: incomingIds.length > 0 ? incomingIds : ["__none__"] },
    },
  });

  await prisma.property.update({
    where: { id: propertyId },
    data: { lastSyncedAt: new Date() },
  });

  return { synced, removed: removed.count, skipped: false };
}

export async function syncAllAirbnbCalendars() {
  const properties = await prisma.property.findMany({
    where: { airbnbIcalUrl: { not: null } },
    select: { id: true, name: true },
  });

  const results: Record<string, Awaited<ReturnType<typeof syncAirbnbCalendar>>> = {};
  for (const p of properties) {
    try {
      results[p.id] = await syncAirbnbCalendar(p.id);
    } catch (err) {
      results[p.id] = { synced: 0, removed: 0, skipped: true };
      console.error(`Airbnb-sync misslyckades för ${p.name}:`, err);
    }
  }
  return results;
}
