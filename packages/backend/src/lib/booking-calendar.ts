import { PrismaClient } from "@prisma/client";

/**
 * The calendar entry that holds booking events for a user/event type.
 *
 * Creating, cancelling and the sync's retry-delete must all resolve the same
 * calendar. Cancel in the dashboard used the target calendar and the retry
 * only the event type's own booking calendar; with a booking calendar set
 * elsewhere, the event was deleted from the wrong calendar or never retried.
 */
export async function findBookingCalendarEntry(db: PrismaClient, userId: string, eventTypeId: string) {
  // 1. Try event-type-specific booking calendar
  const eventType = await db.eventType.findUnique({
    where: { id: eventTypeId },
    select: { bookingCalendarEntryId: true },
  });
  if (eventType?.bookingCalendarEntryId) {
    const entry = await db.calendarEntry.findFirst({
      where: { id: eventType.bookingCalendarEntryId, source: { userId } },
      include: { source: true },
    });
    if (entry) return entry;
  }

  // 2. Try user's global booking calendar
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { bookingCalendarEntryId: true },
  });
  if (user?.bookingCalendarEntryId) {
    const entry = await db.calendarEntry.findFirst({
      where: { id: user.bookingCalendarEntryId, source: { userId } },
      include: { source: true },
    });
    if (entry) return entry;
  }

  // 3. Fall back to target calendar, then first writable
  return db.calendarEntry.findFirst({
    where: {
      source: { userId },
      OR: [{ isTarget: true }, { readOnly: false }],
    },
    include: { source: true },
    orderBy: { isTarget: "desc" },
  });
}
