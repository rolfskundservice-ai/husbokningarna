import ical from "node-ical";
import { prisma } from "@/lib/db";
import { BookingSource, BookingStatus } from "@prisma/client";

/**
 * Hämtar Airbnb-kalendern (.ics) för en property, och synkar
 * dess bokade perioder till Booking-tabellen med source=AIRBNB.
 *
 * - Nya/ändrade Airbnb-bokningar skapas/uppdateras (matchas på externalId).
 * - Airbnb-bokningar som inte längre finns i feeden raderas
 *   (t.ex. om gästen avbokade på Airbnb).
 * - INTERNAL-bokningar rörs aldrig av denna funktion.
 */
export async function syncAirbnbCalendar(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property?.airbnbIcalUrl) {
    return { synced: 0, removed: 0, skipped: true };
  }

  const data = await ical.async.fromURL(property.airbnbIcalUrl);

  const incomingEvents: { externalId: string; start: Date; end: Date; summary?: string }[] = [];

  for (const key of Object.keys(data)) {
    const event = data[key];
    if (event.type !== "VEVENT") continue;
    if (!event.start || !event.end) continue;

    incomingEvents.push({
      externalId: event.uid || key,
      start: event.start as Date,
      end: event.end as Date,
      summary: event.summary as string | undefined,
    });
  }

  let synced = 0;
  for (const ev of incomingEvents) {
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
      },
      create: {
        propertyId,
        externalId: ev.externalId,
        startDate: ev.start,
        endDate: ev.end,
        guestName: ev.summary ?? "Airbnb-gäst",
        source: BookingSource.AIRBNB,
        status: BookingStatus.CONFIRMED,
      },
    });
    synced++;
  }

  // Ta bort Airbnb-bokningar som inte längre finns i feeden
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

/** Synkar alla properties som har en Airbnb-iCal-URL */
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
