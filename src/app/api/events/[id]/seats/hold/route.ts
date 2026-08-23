import { getUserFromRequest } from '@/lib/auth';
import { holdSeatAtomically, releaseSeatHold } from '@/lib/seat-engine';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { seatId, action } = await req.json();

    if (action === 'RELEASE') {
      await releaseSeatHold(seatId, user.userId);
      return NextResponse.json({ success: true, message: 'Hold released' });
    }

    // Default: HOLD
    const result = await holdSeatAtomically(seatId, user.userId);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Seat could not be held' }, { status: 409 });
  }
}