import { prisma } from '@/lib/prisma';
import { cleanupExpiredHoldsAndOffers } from '@/lib/seat-engine';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;

  // Auto clean stale holds before sending status
  await cleanupExpiredHoldsAndOffers();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      venue: true,
      pricing: true,
      seats: {
        orderBy: [{ rowLabel: 'asc' }, { seatNumber: 'asc' }],
        include: {
          holds: {
            where: { expiresAt: { gt: new Date() } },
          },
        },
      },
    },
  });

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  return NextResponse.json({ event });
}