import { prisma } from './prisma';

const HOLD_TTL_MINUTES = 10;
const WAITLIST_OFFER_TTL_MINUTES = 10;

/**
 * 1. Clean up expired holds and offers without nested long transactions
 */
export async function cleanupExpiredHoldsAndOffers() {
  const now = new Date();

  // Find expired holds
  const expiredHolds = await prisma.seatHold.findMany({
    where: { expiresAt: { lte: now } },
    select: { id: true, seatId: true },
  });

  if (expiredHolds.length > 0) {
    const expiredIds = expiredHolds.map((h) => h.id);
    const seatIds = Array.from(new Set(expiredHolds.map((h) => h.seatId)));

    // Delete expired holds in one query
    await prisma.seatHold.deleteMany({
      where: { id: { in: expiredIds } },
    });

    // Reset seats back to AVAILABLE if not booked and no valid active holds remain
    for (const sId of seatIds) {
      const activeHolds = await prisma.seatHold.count({
        where: { seatId: sId, expiresAt: { gt: now } },
      });

      if (activeHolds === 0) {
        await prisma.seat.updateMany({
          where: { id: sId, status: 'HELD' },
          data: { status: 'AVAILABLE' },
        });
      }
    }
  }

  // Expire stale waitlist offers
  const expiredOffers = await prisma.waitlist.findMany({
    where: {
      status: 'OFFERED',
      offerExpiry: { lte: now },
    },
  });

  for (const offer of expiredOffers) {
    await prisma.waitlist.update({
      where: { id: offer.id },
      data: { status: 'EXPIRED' },
    });

    if (offer.offerSeatId) {
      await triggerWaitlistForSeat(offer.eventId, offer.offerSeatId, offer.category);
    }
  }
}

/**
 * 2. Atomic seat hold with concurrency protection
 */
export async function holdSeatAtomically(seatId: string, userId: string) {
  await cleanupExpiredHoldsAndOffers();

  // Atomic check-and-set: updates to HELD ONLY IF status is AVAILABLE
  const updateResult = await prisma.seat.updateMany({
    where: {
      id: seatId,
      status: 'AVAILABLE',
    },
    data: {
      status: 'HELD',
    },
  });

  if (updateResult.count === 0) {
    // Check if it's already held or booked
    const seat = await prisma.seat.findUnique({ where: { id: seatId } });
    throw new Error(`Seat is currently ${seat?.status.toLowerCase() || 'unavailable'}`);
  }

  const expiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000);

  // Clear previous holds for this seat and insert new hold
  await prisma.seatHold.deleteMany({ where: { seatId } });
  const hold = await prisma.seatHold.create({
    data: {
      seatId,
      userId,
      expiresAt,
    },
  });

  const seat = await prisma.seat.findUnique({ where: { id: seatId } });

  return { seat, hold, expiresAt };
}

/**
 * 3. Release seat hold explicitly
 */
export async function releaseSeatHold(seatId: string, userId: string) {
  await prisma.seatHold.deleteMany({
    where: { seatId, userId },
  });

  const activeHolds = await prisma.seatHold.count({
    where: { seatId, expiresAt: { gt: new Date() } },
  });

  if (activeHolds === 0) {
    await prisma.seat.updateMany({
      where: { id: seatId, status: 'HELD' },
      data: { status: 'AVAILABLE' },
    });
  }
}

/**
 * 4. Auto-reallocate seat to next waitlist customer
 */
export async function triggerWaitlistForSeat(
  eventId: string,
  seatId: string,
  category: 'STANDARD' | 'PREMIUM' | 'VIP'
) {
  const nextInLine = await prisma.waitlist.findFirst({
    where: {
      eventId,
      category,
      status: 'WAITING',
    },
    orderBy: { createdAt: 'asc' },
    include: { user: true },
  });

  if (!nextInLine) {
    await prisma.seat.update({
      where: { id: seatId },
      data: { status: 'AVAILABLE' },
    });
    return null;
  }

  const offerExpiry = new Date(Date.now() + WAITLIST_OFFER_TTL_MINUTES * 60 * 1000);

  await prisma.seat.update({
    where: { id: seatId },
    data: { status: 'HELD' },
  });

  const updatedWaitlist = await prisma.waitlist.update({
    where: { id: nextInLine.id },
    data: {
      status: 'OFFERED',
      offeredAt: new Date(),
      offerExpiry,
      offerSeatId: seatId,
    },
    include: { user: true },
  });

  return updatedWaitlist;
}