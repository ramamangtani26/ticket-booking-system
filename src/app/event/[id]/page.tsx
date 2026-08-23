'use client';

import { use, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';

export default function EventBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);

  const [event, setEvent] = useState<any>(null);
  const [heldSeat, setHeldSeat] = useState<any>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState<any>(null);

  const [waitlistCategory, setWaitlistCategory] = useState('STANDARD');
  const [waitlistMessage, setWaitlistMessage] = useState('');

  const fetchSeats = async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/seats`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setEvent(data.event);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSeats();
    const interval = setInterval(fetchSeats, 3000);
    return () => clearInterval(interval);
  }, [eventId]);

  useEffect(() => {
    if (!holdExpiresAt) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0) {
        setHeldSeat(null);
        setHoldExpiresAt(null);
        setError('Seat hold expired. Seat has been released.');
        fetchSeats();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [holdExpiresAt]);

  const handleHoldSeat = async (seat: any) => {
    if (seat.status !== 'AVAILABLE') return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/seats/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ seatId: seat.id, action: 'HOLD' }),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || 'Seat selection failed. Please make sure you are logged in.');
        fetchSeats();
        return;
      }

      setHeldSeat(seat);
      setHoldExpiresAt(new Date(data.data.expiresAt));
      fetchSeats();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to select seat');
    }
  };

  const handleReleaseHold = async () => {
    if (!heldSeat) return;
    await fetch('/api/seats/hold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ seatId: heldSeat.id, action: 'RELEASE' }),
    });
    setHeldSeat(null);
    setHoldExpiresAt(null);
    fetchSeats();
  };

  const handleConfirmBooking = async () => {
    if (!heldSeat) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ seatId: heldSeat.id }),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || 'Booking failed');
        return;
      }

      setBookingSuccess(data);
      setHeldSeat(null);
      setHoldExpiresAt(null);
      fetchSeats();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Booking failed');
    }
  };

  const handleJoinWaitlist = async () => {
    setError('');
    setWaitlistMessage('');
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ eventId, category: waitlistCategory }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to join waitlist. Please make sure you are logged in.');
      return;
    }

    setWaitlistMessage(`Successfully joined the ${waitlistCategory} waitlist queue! You will receive an offer if a seat cancels.`);
  };

  if (!event) {
    return (
      <div>
        <Navbar />
        <div className="p-12 text-center text-slate-400">Loading seat map...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <Navbar />

      <div className="max-w-5xl mx-auto px-6 pt-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{event.title}</h1>
          <p className="text-slate-400 text-sm">{event.venue.name} • {new Date(event.startTime).toLocaleString()}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-950 border border-rose-800 text-rose-200 text-sm rounded-lg">
            {error}
          </div>
        )}

        {bookingSuccess && (
          <div className="mb-8 p-6 bg-emerald-950/80 border border-emerald-700 rounded-xl text-center">
            <h3 className="text-2xl font-bold text-emerald-300 mb-2">🎉 Booking Confirmed!</h3>
            <p className="text-sm text-emerald-100 mb-4">
              Booking Ref: <strong className="font-mono">{bookingSuccess.booking.bookingRef}</strong>
            </p>
            {bookingSuccess.qrCodeUrl && (
              <div className="flex flex-col items-center justify-center">
                <img src={bookingSuccess.qrCodeUrl} alt="Ticket QR" className="w-44 h-44 rounded-lg bg-white p-2 mb-2 shadow" />
                <span className="text-xs text-emerald-300">Ticket QR code generated and dispatched via email.</span>
              </div>
            )}
          </div>
        )}

        {heldSeat && (
          <div className="mb-6 p-4 bg-amber-950/70 border border-amber-600 rounded-lg flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-amber-300">
                Seat {heldSeat.rowLabel}{heldSeat.seatNumber} is reserved for you.
              </p>
              <p className="text-xs text-amber-200">
                Auto-releasing in: <span className="font-mono font-bold text-base text-white">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReleaseHold}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded cursor-pointer"
              >
                Release
              </button>
              <button
                onClick={handleConfirmBooking}
                disabled={loading}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 font-bold text-white px-4 py-1.5 rounded cursor-pointer"
              >
                {loading ? 'Processing...' : 'Pay & Confirm'}
              </button>
            </div>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 mb-8">
          <div className="w-full bg-slate-800/80 text-center py-1.5 rounded text-xs font-semibold tracking-widest text-slate-400 mb-8 uppercase">
            STAGE / SCREEN
          </div>

          <div className="flex flex-col gap-3 items-center overflow-x-auto">
            {Array.from(new Set(event.seats.map((s: any) => s.rowLabel))).map((row: any) => (
              <div key={row} className="flex items-center gap-2">
                <span className="w-6 text-xs font-mono font-bold text-slate-500 text-center">{row}</span>
                <div className="flex gap-2">
                  {event.seats
                    .filter((s: any) => s.rowLabel === row)
                    .map((seat: any) => {
                      const isMyHold = heldSeat?.id === seat.id;
                      const isHeldByOther = seat.status === 'HELD' && !isMyHold;
                      const isBooked = seat.status === 'BOOKED';

                      let btnStyle = 'bg-slate-800 hover:bg-indigo-600 text-slate-200 border-slate-700 cursor-pointer';
                      if (seat.category === 'VIP') btnStyle = 'bg-amber-950/60 hover:bg-amber-600 text-amber-200 border-amber-800 cursor-pointer';
                      if (seat.category === 'PREMIUM') btnStyle = 'bg-indigo-950/60 hover:bg-indigo-600 text-indigo-200 border-indigo-800 cursor-pointer';
                      if (isMyHold) btnStyle = 'bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-300 cursor-pointer';
                      if (isHeldByOther) btnStyle = 'bg-amber-900/50 text-amber-500 border-amber-800 cursor-not-allowed';
                      if (isBooked) btnStyle = 'bg-slate-950 text-slate-700 border-slate-900 cursor-not-allowed line-through';

                      return (
                        <button
                          key={seat.id}
                          disabled={isBooked || isHeldByOther}
                          onClick={() => handleHoldSeat(seat)}
                          title={`${seat.rowLabel}${seat.seatNumber} (${seat.category}) - ${seat.status}`}
                          className={`w-10 h-10 rounded text-xs font-mono font-bold border flex items-center justify-center transition ${btnStyle}`}
                        >
                          {seat.seatNumber}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-6 mt-8 text-xs text-slate-400 border-t border-slate-800 pt-6">
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 bg-slate-800 border border-slate-700 rounded"></div> Available</div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 bg-amber-900/50 border border-amber-800 rounded"></div> Held (TTL)</div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 bg-slate-950 border border-slate-900 rounded"></div> Booked</div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 bg-emerald-600 rounded"></div> Selected</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-2">Category Waitlist Queue</h3>
          <p className="text-xs text-slate-400 mb-4">
            Join the queue for a category. When a customer cancels, the seat is automatically offered to the next waitlisted user.
          </p>

          {waitlistMessage && (
            <div className="mb-4 p-3 bg-indigo-950 border border-indigo-700 text-indigo-300 text-xs rounded">
              {waitlistMessage}
            </div>
          )}

          <div className="flex gap-3">
            <select
              value={waitlistCategory}
              onChange={(e) => setWaitlistCategory(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-white outline-none"
            >
              <option value="STANDARD">Standard Category</option>
              <option value="PREMIUM">Premium Category</option>
              <option value="VIP">VIP Category</option>
            </select>
            <button
              onClick={handleJoinWaitlist}
              className="bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold px-4 py-2 rounded transition cursor-pointer"
            >
              Join Waitlist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}