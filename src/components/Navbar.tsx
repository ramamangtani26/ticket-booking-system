'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      });
  }, []);

  const handleLogout = () => {
    document.cookie = 'token=; Max-Age=0; path=/;';
    setUser(null);
    router.push('/login');
    router.refresh();
  };

  return (
    <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
      <Link href="/" className="text-xl font-bold text-indigo-400 flex items-center gap-2">
        🎟️ TicketPulse
      </Link>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span className="text-sm text-slate-400">
              {user.name} <span className="text-xs bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded font-mono">[{user.role}]</span>
            </span>
            <Link href="/dashboard" className="text-sm text-slate-300 hover:text-white transition">
              Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-700 px-3 py-1.5 rounded transition"
            >
              Sign Out
            </button>
          </>
        ) : (
          <div className="flex gap-2">
            <Link
              href="/login"
              className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded transition font-medium"
            >
              Login / Register
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}