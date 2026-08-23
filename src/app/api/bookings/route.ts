import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { generateQRCode, sendBookingEmail, sendWaitlistOfferEmail } from '@/lib/email';
import { triggerWaitlistForSeat } from '@/lib/seat-engine';
import { NextRequest, NextResponse } from 'next/server';

// Get booking history or organiser revenue summary
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.role === 'ORGANISER') {
    const events = await prisma.event.findMany({
      where: { organiserId: user.userId },
      include: {
        seats: {
          include: { booking: true },
        },
      },
    });

    const summary = events.map((ev) => {
      const confirmedBookings = ev.seats.filter((s) => s.booking && s.booking.status === 'CONFIRMED');
      const revenue = confirmedBookings.reduce((sum, s) => sum + (s.booking?.totalAmount || 0), 0);
      return {
        eventId: ev.id,
        title: ev.title,
        totalSeats: ev.seats.length,
        bookedSeats: confirmedBookings.length,
        revenue,
      };
    });

    return NextResponse.json({ summary });
  }

  const bookings = await prisma.booking.findMany({
    where: { userId: user.userId },
    include: {
      seat: {
        include: { event: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ bookings });
}

// Complete Booking
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { seatId } = await req.json();

    const seat = await prisma.seat.findUnique({
      where: { id: seatId },
      include: {
        event: {
          include: { pricing: true },
        },
      },
    });

    if (!seat) return NextResponse.json({ error: 'Seat not found' }, { status: 404 });

    // Validate hold or waitlist offer
    const activeHold = await prisma.seatHold.findFirst({
      where: { seatId, userId: user.userId, expiresAt: { gt: new Date() } },
    });

    const waitlistOffer = await prisma.waitlist.findFirst({
      where: { userId: user.userId, offerSeatId: seatId, status: 'OFFERED', offerExpiry: { gt: new Date() } },
    });

    if (!activeHold && !waitlistOffer) {
      return NextResponse.json({ error: 'Seat hold expired or not held by you' }, { status: 400 });
    }

    const price = seat.event.pricing.find((p) => p.category === seat.category)?.price || 50;

    // Mark seat as BOOKED
    await prisma.seat.update({
      where: { id: seatId },
      data: { status: 'BOOKED' },
    });

    // Remove active hold
    await prisma.seatHold.deleteMany({ where: { seatId } });

    // Mark waitlist offer accepted if applicable
    if (waitlistOffer) {
      await prisma.waitlist.update({
        where: { id: waitlistOffer.id },
        data: { status: 'ACCEPTED' },
      });
    }

    // Create Booking
    const booking = await prisma.booking.create({
      data: {
        userId: user.userId,
        seatId: seat.id,
        totalAmount: price,
        status: 'CONFIRMED',
      },
    });

    // Generate QR Code containing booking ref and seat details
    const qrDataUrl = await generateQRCode(
      `REF:${booking.bookingRef}|SHOW:${seat.event.title}|SEAT:${seat.rowLabel}${seat.seatNumber}`
    );

    await prisma.booking.update({
      where: { id: booking.id },
      data: { qrCodeUrl: qrDataUrl },
    });

    // Dispatch email
    await sendBookingEmail(
      user.email,
      booking.bookingRef,
      seat.event.title,
      `${seat.rowLabel}${seat.seatNumber} (${seat.category})`,
      qrDataUrl
    );

    return NextResponse.json({ success: true, booking, qrCodeUrl: qrDataUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Booking failed' }, { status: 400 });
  }
}

// Cancel Booking -> Auto-trigger Waitlist Reallocation
export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { bookingId } = await req.json();

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId, userId: user.userId },
      include: { seat: { include: { event: true } } },
    });

    if (!booking || booking.status !== 'CONFIRMED') {
      return NextResponse.json({ error: 'Active booking not found' }, { status: 404 });
    }

    // Cancel booking
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
    });

    // Trigger waitlist cascade for this seat
    const nextOffer = await triggerWaitlistForSeat(
      booking.seat.eventId,
      booking.seat.id,
      booking.seat.category
    );

    if (nextOffer && nextOffer.user) {
      const offerLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/event/${booking.seat.eventId}?seatId=${booking.seat.id}&offer=true`;
      await sendWaitlistOfferEmail(
        nextOffer.user.email,
        booking.seat.event.title,
        offerLink,
        10
      );
    }

    return NextResponse.json({ success: true, message: 'Booking cancelled & offered to waitlist' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}