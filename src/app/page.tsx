import { prisma } from '@/lib/prisma';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

export const revalidate = 0;

export default async function HomePage() {
  const events = await prisma.event.findMany({
    include: {
      venue: true,
      pricing: true,
      seats: true,
    },
    orderBy: { startTime: 'asc' },
  });

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
            Live Shows & Instant Bookings
          </h1>
          <p className="text-slate-400">
            Real-time visual seat map, concurrent locking, auto-release hold TTL, and automated cancellation waitlists[cite: 1].
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((ev) => {
            const availableCount = ev.seats.filter((s) => s.status === 'AVAILABLE').length;
            const isSoldOut = availableCount === 0;

            return (
              <div
                key={ev.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-xs px-2.5 py-1 rounded font-semibold ${isSoldOut ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'}`}>
                      {isSoldOut ? 'SOLD OUT' : `${availableCount} Seats Open`}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {new Date(ev.startTime).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-1">{ev.title}</h3>
                  <p className="text-xs text-slate-400 mb-4">{ev.venue.name} • {ev.venue.location}</p>
                  <p className="text-sm text-slate-300 line-clamp-2 mb-6">{ev.description}</p>
                </div>

                <div>
                  <div className="flex gap-2 mb-4">
                    {ev.pricing.map((p) => (
                      <span key={p.id} className="text-xs bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded">
                        {p.category}: <strong className="text-white">${p.price}</strong>
                      </span>
                    ))}
                  </div>

                  <Link
                    href={`/event/${ev.id}`}
                    className="block text-center w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded transition"
                  >
                    {isSoldOut ? 'Join Waitlist / View Map' : 'Select Seats →'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}