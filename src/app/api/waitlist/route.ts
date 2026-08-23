import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { eventId, category } = await req.json();

    const waitlistEntry = await prisma.waitlist.create({
      data: {
        eventId,
        userId: user.userId,
        category,
        status: 'WAITING',
      },
    });

    return NextResponse.json({ success: true, waitlist: waitlistEntry });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}