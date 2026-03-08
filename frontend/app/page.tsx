'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Leaf, Heart, Star, Award } from 'lucide-react';
import { useAuthStore } from '@/lib/store';

const FEATURES = [
  {
    icon: Heart,
    title: 'Donate surplus food',
    body: 'List food you want to share. A nearby neighbour confirms pickup — both earn Karma Points.',
  },
  {
    icon: Star,
    title: 'Earn $SHARE tokens',
    body: 'Exchange Karma Points for $SHARE at a 10 : 1 rate. Minimum 100 karma per exchange.',
  },
  {
    icon: Award,
    title: 'Mint NFT medals',
    body: 'Hit Bronze, Silver, Gold or Platinum milestones and mint a permanent on-chain medal.',
  },
];

export default function LandingPage() {
  const router          = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated        = useAuthStore((s) => s._hydrated);

  useEffect(() => {
    if (hydrated && isAuthenticated) router.replace('/feed');
  }, [hydrated, isAuthenticated, router]);

  // Wait for Zustand to rehydrate from localStorage before deciding what to
  // render — prevents server/client mismatch (server always has false).
  if (!hydrated) return null;
  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Leaf className="h-6 w-6 text-primary-600" />
          <span className="text-lg font-bold text-gray-900">FOODSHI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 mb-6">
          <Leaf className="h-9 w-9 text-primary-600" />
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight max-w-xl">
          Share food.{' '}
          <span className="text-primary-600">Earn rewards.</span>
        </h1>

        <p className="mt-5 text-lg text-gray-500 max-w-md leading-relaxed">
          FOODSHI turns surplus food into Karma Points, $SHARE tokens, and NFT medals —
          all on Polygon.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/signup"
            className="rounded-xl bg-primary-600 px-7 py-3 text-base font-semibold text-white shadow-sm hover:bg-primary-700 transition"
          >
            Start donating
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-gray-300 px-7 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Sign in
          </Link>
        </div>
      </main>

      {/* Features */}
      <section className="border-t border-gray-100 bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-3xl grid gap-6 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 mb-4">
                <Icon className="h-5 w-5 text-primary-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-5 text-center text-xs text-gray-400">
        Built on Polygon Amoy · $SHARE ERC-20 · Chainlink CRE emission
      </footer>
    </div>
  );
}
