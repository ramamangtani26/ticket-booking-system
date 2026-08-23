'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const authRes = await fetch('/api/auth');
    const authData = await authRes.json();
    if (!authData.user) {
      setLoading(false);
      return;
    }
    setUser(authData.user);

    const res = await fetch('/api/bookings');
    const resData = await res.json();
    setData(resData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel? This seat will be offered immediately to the waitlist[cite: 1].')) return;

    const res = await fetch('/api/bookings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId }),
    });

    if (res.ok) {
      alert('Booking cancelled and offered to waitlist[cite: 1]!');
      loadData();
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-white mb-6">
          {user?.role === 'ORGANISER' ? 'Organiser Revenue & Sales Dashboard' : 'My Bookings & QR Tickets'}
        </h1>

        {loading ? (
          <div className="text-slate-400">Loading dashboard...</div>
        ) : user?.role === 'ORGANISER' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data?.summary?.map((ev: any) => (
              <div key={ev.eventId} className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                <h3 className="text-lg font-bold text-white mb-4">{ev.title}</h3>
                <div className="grid grid-cols-3 gap-2 text-center mb-4">
                  <div className="bg-slate-950 p-3 rounded">
                    <div className="text-xs text-slate-500">Total Seats</div>
                    <div className="text-lg font-bold text-white">{ev.totalSeats}</div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded">
                    <div className="text-xs text-slate-500">Booked</div>
                    <div className="text-lg font-bold text-indigo-400">{ev.bookedSeats}</div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded">
                    <div className="text-xs text-slate-500">Revenue</div>
                    <div className="text-lg font-bold text-emerald-400">${ev.revenue}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {data?.bookings?.length === 0 ? (
              <p className="text-slate-400">No bookings found.</p>
            ) : (
              data?.bookings?.map((b: any) => (
                <div
                  key={b.id}
                  className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex justify-between items-center"
                >
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded font-mono font-semibold ${b.status === 'CONFIRMED' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
                      {b.status}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-1">{b.seat.event.title}</h3>
                    <p className="text-xs text-slate-400">
                      Seat: <strong className="text-white">{b.seat.rowLabel}{b.seat.seatNumber} ({b.seat.category})</strong> • Ref: <span className="font-mono">{b.bookingRef}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    {b.qrCodeUrl && b.status === 'CONFIRMED' && (
                      <img src={b.qrCodeUrl} alt="QR Code" className="w-16 h-16 rounded bg-white p-1" />
                    )}
                    {b.status === 'CONFIRMED' && (
                      <button
                        onClick={() => handleCancelBooking(b.id)}
                        className="text-xs bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-700 px-3 py-2 rounded transition"
                      >
                        Cancel Booking
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}